# Robotics Bench — 3D Interactive Circuit Sandbox Architecture

## 1. Executive Summary & Architectural Vision

The **Custom Experiment Bench (Sandbox)** expands the existing Robotics Bench application from a single-board assembly viewer into an interactive, physics-aware 3D electronics prototyping workbench. Users place 3D components onto a desk or breadboard, route procedural 3D jumper wires between pins and tie-points, run pre-built logic programs or manual pin drivers, observe **animated current flow** (where current starts and where it goes along active paths), and inspect electrical behavior—including dead shorts, over-voltage damage, LED overcurrent burnout, pin/source overloads, and floating input warnings—before connecting physical hardware.

### Coordinate & Unit Convention

- **Coordinate System:** Right-handed, **Y-up** (`+Y` up, `+X` right, `+Z` toward viewer).
- **Length Unit:** **1 scene unit = 1 meter (`1.0 m`)** for world/desk coordinates; **1 millimetre (`1 mm`) = `0.001` scene units** for component manifests and standard `2.54 mm` (`0.00254` scene units) breadboard pitch. Because millimetre-scale features are small in scene meters, use a standard 24-bit depth buffer with `camera.near = 0.002` and `camera.far <= 20`, apply `polygonOffset` to coplanar surfaces, and scale hole-hit/snap radii proportionally to `pitchMeters`. Enable `logarithmicDepthBuffer` only if a spike shows depth-precision failures. Ensure `1 unit = 0.01 m` (`1 cm`) is not mixed with `1.0 m` world coordinates.
- **Model Scaling:** Every `ComponentDef` defines `modelScale` (default `1.0`) so `.glb` assets authored in millimetres (`0.001`) or centimetres (`0.01`) normalize into scene meters cleanly.
- **Angles:** Radians in Three.js (`Euler` / `Matrix4`), with `90°` (`Math.PI / 2`) increments enforced for breadboard-snapped parts.
- **Electrical Units:** Volts (`V`), milliamperes (`mA`), ohms (`Ω`), and simulated seconds (`simTimeSec`).

### Fidelity & Non-Goals (Phase 1)

Phase 1 targets fast, deterministic prototyping feedback rather than laboratory sign-off.

- **Included in Phase 1:** Disjoint-Set Union (DSU) net equivalence, a net-level component graph, a finite-resistance DC resistive + ideal-source nodal solver with piecewise-linear LED iteration, discrete digital (`HIGH`, `LOW`, `Z`) and PWM logic states, fault detection (`DEAD_SHORT`, `RAIL_CONTENTION`, `GPIO_CONTENTION`, `OVER_VOLTAGE`, `REVERSE_POLARITY`, `LED_OVERCURRENT`, `PIN_OVERCURRENT`, `NO_COMMON_GROUND`, `FLOATING_PIN`), latched component burnout and source overload states, animated current flow directional indicators, and pre-built/manual logic programs.
- **Explicit Non-Goals in Phase 1:** AC frequency/phase analysis, parasitic inductance/capacitance, high-frequency signal integrity/transmission lines, cycle-accurate MCU instruction timing, and full SPICE MNA nonlinear transient solving (reserved for Phase 2).
- **Timing Model:** The `1/60 s` tick is a behavioral step, not an electrical timeline. Pulse-level timing (servo PWM pulse width, ultrasonic trig/echo) is computed analytically, not simulated sample by sample (see §5.6.6).

---

## 2. Tech Stack & Runtime Boundaries

| Layer                         | Technology                                                                                 | Role & Constraints                                                                                                                                                                                                                                                                                         |
| :---------------------------- | :----------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI & 3D Viewport**          | React `v19`, TypeScript (strict), Three.js, `@react-three/fiber` `v9`, `@react-three/drei` | Renders desk, breadboard, `.glb` modules, procedural wires, animated current flow pulses, and fault VFX. `registry/*` must remain free of `three` and `react` imports so worker code can import manifests.                                                                                                 |
| **Undoable Graph State**      | **Zustand** + **Zundo** (`partialize` on `{ placedComponents, wires }`)                    | Tracks committed structural edits with `Ctrl+Z` / `Ctrl+Y` history. Excludes `powerEnabled`, selection/hover state, live `inputStates`, manual pin overrides, and telemetry streams.                                                                                                                       |
| **Transient Telemetry Store** | Non-reactive external store (`Float32Array` / `Uint8Array` ring buffers + listener set)    | Receives compact binary/typed frames pushed from the worker and feeds `useFrame` or targeted HUD subscriptions without triggering full React tree re-renders every tick.                                                                                                                                   |
| **Worker RPC**                | **Comlink** over Web Workers                                                               | Isolates simulation execution off the main thread. Unproxied JS functions are never passed over `postMessage`; `EngineClient` wraps listeners with `Comlink.proxy(...)`.                                                                                                                                   |
| **Persistence & Validation**  | **idb-keyval** (IndexedDB), **lz-string** (`compressToEncodedURIComponent`), **Zod**       | Versioned local saves (`schemaVersion`), migrations, `calibratedModelVersion` drift detection, strict size/type validation via `zod`, and a referential-integrity pass (`validateTopologyIntegrity`) verifying `defId`, `boardId`, `HoleCoord` bounds, and `pinId`s before touching store or worker state. |
| **Testing**                   | **Vitest**                                                                                 | Unit and fixture tests for DSU nets, DC nodal + piecewise-linear LED solver, fault latching, manifest invariants, persistence migrations, and Comlink proxy wrappers.                                                                                                                                      |

---

## 3. High-Level System Architecture

```text
+---------------------------------------------------------------------------------------+
|                                    MAIN UI / 3D THREAD                              |
|                                                                                       |
|  +-------------------------+   +---------------------------+   +--------------------+  |
|  | Component & Program HUD |   | R3F 3D Workbench Scene    |   | Probe & Fault HUD  |  |
|  | - Parts & Sources Bin   |   | - Desk & Breadboard Grid  |   | - Logic/DMM Readout|  |
|  | - Program / Manual Pins |   | - Placed .glb Modules     |   | - Fault & Fix List |  |
|  | - Power / Reset / Undo  |   | - Procedural Tube Wires   |   | - BOM / Share URL  |  |
|  +------------+------------+   | - Current Flow & Burn VFX |   +---------+----------+  |
|               |                +-------------+-------------+             ^             |
|               v                              |                           |             |
|  +-------------------------------------------+---------------------------+-----------+  |
|  | Zustand + Zundo (Undoable: placedComponents, wires)   | Transient Telemetry Store|  |
|  +-------------------------------------------+---------------------------+-----------+  |
|                                              |                           ^             |
|  +-------------------------------------------+---------------------------+-----------+  |
|  | EngineClient (Main-thread async facade wrapping callbacks with Comlink.proxy)    |  |
|  +-------------------------------------------+---------------------------+-----------+  |
+----------------------------------------------|---------------------------|-------------+
                                               | CircuitTopologySnapshot   | SimulationFrame
                                               | & Control Commands        | (Compact TypedArrays)
                                               v                           |
+---------------------------------------------------------------------------------------+
|                              SIMULATION WEB WORKER(S)                                 |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                            WorkerSimulationEngine                               |  |
|  |  Async RPC: init(), loadTopology(), loadProgram(), setPower(), setInputState(), |  |
|  |             setManualPin(), resetFaults(), onFrame(), onError(), dispose()      |  |
|  |  Future Phase 2 Ports: digitalPort (MCU/logic) + analogPort (resistive/SPICE)   |  |
|  +----------------------------------------+----------------------------------------+  |
|                                           |                                           |
|             +-----------------------------+-----------------------------+             |
|             v                             v                             v             |
|  +---------------------+      +-----------------------+      +--------------------+  |
|  | buildNets() [Pure]  | ---> | Finite-R DC Nodal &   | ---> | validate() [Pure]  |  |
|  | - PinAddress keys   |      | Piecewise LED Solver  |      | - Latched burntSet |  |
|  | - DSU net merging   |      | - Connected islands   |      | - Latched overloads|  |
|  | - Net graph edges   |      | - Current flow paths  |      | - Pin-mode checks  |  |
|  +---------------------+      +-----------------------+      +--------------------+  |
|                                           ^                                           |
|                                           |                                           |
|                               +-----------+-----------+                               |
|                               | Program Runtime       |                               |
|                               | (Fixed-dt accumulator)|                               |
|                               +-----------------------+                               |
+---------------------------------------------------------------------------------------+
```

---

## 4. Core Data Models (`src/types/circuit.ts`)

### 4.1 Identifiers, Pin Addresses, Grid & Component Manifest

```typescript
// All componentId, instanceId, pinId, and programId values must match /^[a-zA-Z0-9_-]+$/ (no ':')
export type SafeId = string;

// Canonical address format:
// - Component pin: "<instanceId>:<pinId>" (e.g., "uno_a1b2:D13")
// - Breadboard hole: "<boardId>:<region>:<col>:<row>" (e.g., "bb_c3d4:MAIN:12:0")

export type PinAddress = string;

// Default limit = DEFAULT_I2T_FACTOR_S * (maxCurrentMa / 1000)^2  (≈0.4 s at 2x rated current)
export const DEFAULT_I2T_FACTOR_S = 1.2;
// Fallback only when a part has no current rating at all
export const DEFAULT_I2T_LIMIT_A2S = 0.0005;

export type BreadboardRegion =
  | "MAIN"
  | "TOP_POS"
  | "TOP_NEG"
  | "BOT_POS"
  | "BOT_NEG";

export interface HoleCoord {
  region: BreadboardRegion;
  col: number;
  row: number;
}

export type PinRef =
  | { kind: "PIN"; instanceId: SafeId; pinId: SafeId }
  | { kind: "HOLE"; boardId: SafeId; hole: HoleCoord };

export interface GridSpec {
  cols: number;
  rowsPerSide: number;
  pitchMeters: number;
  hasCenterGap: boolean;
  hasPowerRails: boolean;
  railCols?: number; // e.g., 50; required when hasPowerRails
  railSegments?: number[]; // e.g., [25, 25]; each segment is an electrically separate strip; must sum to railCols
}

export type GpioPinMode =
  | "INPUT"
  | "INPUT_PULLUP"
  | "OUTPUT_DIGITAL"
  | "OUTPUT_PWM";

export interface BasePinDefinition {
  id: SafeId;
  label: string;
  localPosition: [number, number, number]; // Meters in scaled model local space
  normal: [number, number, number]; // Unit vector for wire exit direction
  internalNetGroup?: SafeId; // Same group = internally tied inside part
}

export interface PowerOutPinDef extends BasePinDefinition {
  type: "POWER_OUT";
  nominalVoltage: number;
  maxCurrentMa: number;
  internalOhm: number;
  i2tLimitA2s?: number;
}

export interface PowerInPinDef extends BasePinDefinition {
  type: "POWER_IN";
  nominalVoltage: number;
  maxVoltage: number;
  polarized?: boolean; // default true; false for polarity-insensitive inputs
  maxCurrentMa: number;
  i2tLimitA2s?: number;
}

export interface GndPinDef extends BasePinDefinition {
  type: "GND";
  maxCurrentMa: number;
  internalOhm: number;
  i2tLimitA2s?: number;
}

export interface GpioPinDef extends BasePinDefinition {
  type: "GPIO";
  logicHighV: number; // e.g., 5.0 for Uno, 3.3 for ESP32
  maxVoltage: number;
  maxCurrentMa: number;
  internalOhm: number;
  allowedModes: GpioPinMode[];
  defaultMode: GpioPinMode;
  pullupOhm?: number; // INPUT_PULLUP series resistance; default 35000
  i2tLimitA2s?: number;
}

export interface AnalogInPinDef extends BasePinDefinition {
  type: "ANALOG_IN";
  maxVoltage: number;
}

export interface PassivePinDef extends BasePinDefinition {
  type: "PASSIVE";
  maxVoltage?: number;
}

export interface SignalPinDef extends BasePinDefinition {
  type: "SIGNAL_IN" | "SIGNAL_OUT";
  nominalVoltage: number;
  maxVoltage: number;
  inputOhm?: number; // SIGNAL_IN only: resistance to the device's own GND net; default 100000
  requiredDriven?: boolean; // SIGNAL_IN only: emit FLOATING_PIN when powered and undriven
}

export type PinDefinition =
  | PowerOutPinDef
  | PowerInPinDef
  | GndPinDef
  | GpioPinDef
  | AnalogInPinDef
  | PassivePinDef
  | SignalPinDef;

export type ComponentElectricalModel =
  | { kind: "RESISTOR"; pinA: SafeId; pinB: SafeId; ohms: number }
  | {
      kind: "LED";
      anodePinId: SafeId;
      cathodePinId: SafeId;
      vf: number;
      imaxMa: number;
      rdOhm: number;
      i2tLimitA2s?: number; // defaults to DEFAULT_I2T_FACTOR_S * (imaxMa / 1000)^2
    }
  | {
      kind: "SWITCH";
      pinA: SafeId;
      pinB: SafeId;
      normallyClosed?: boolean;
      contactOhm: number;
    }
  | {
      kind: "POTENTIOMETER";
      pinA: SafeId;
      wiperPinId: SafeId;
      pinB: SafeId;
      totalOhms: number;
    }
  | {
      kind: "SOURCE";
      posPinId: SafeId;
      negPinId: SafeId;
      volts: number;
      maxMa: number;
      internalOhm: number;
    }
  | {
      kind: "MCU";
      architecture: "AVR_SIM" | "ESP32_SIM" | "BEHAVIORAL";
      logicHighV: number;
      supply5vPinId?: SafeId;
      supply3v3PinId?: SafeId;
      gndPinIds: SafeId[];
    }
  | {
      kind: "ACTUATOR_SERVO";
      minAngleDeg: number;
      maxAngleDeg: number;
      signalPinId: SafeId;
      vccPinId: SafeId;
      gndPinId: SafeId;
      nominalV: number;
      loadOhm: number;
      maxMa: number;
    }
  | {
      kind: "ACTUATOR_DC_MOTOR";
      pinA: SafeId;
      pinB: SafeId;
      nominalV: number;
      loadOhm: number;
      maxMa: number;
    }
  | {
      kind: "ACTUATOR_MOTOR_DRIVER";
      in1PinId: SafeId;
      in2PinId: SafeId;
      enaPinId?: SafeId;
      in3PinId?: SafeId;
      in4PinId?: SafeId;
      enbPinId?: SafeId;
      out1APinId: SafeId;
      out1BPinId: SafeId;
      out2APinId?: SafeId;
      out2BPinId?: SafeId;
      supplyPinId: SafeId;
      logicSupplyPinId?: SafeId;
      gndPinId: SafeId;
      maxSupplyV: number;
      dropoutV: number;
      maxChannelMa: number;
      loadOhm: number;
      i2tLimitA2s?: number;
    }
  | {
      kind: "SENSOR_ULTRASONIC";
      trigPinId: SafeId;
      echoPinId: SafeId;
      vccPinId: SafeId;
      gndPinId: SafeId;
      nominalV: number;
      loadOhm: number;
      maxMa: number;
      minRangeCm: number;
      maxRangeCm: number;
      defaultDistanceCm: number;
    }
  | { kind: "BREADBOARD"; grid: GridSpec }
  | { kind: "GENERIC_PASSIVE"; pinA: SafeId; pinB: SafeId; ohms: number };

export interface ComponentDef {
  id: SafeId;
  modelVersion: number;
  modelScale: number; // Scale applied to .glb asset so units match scene meters
  name: string;
  category:
    | "MCU"
    | "POWER"
    | "ACTUATOR"
    | "SENSOR"
    | "DRIVER"
    | "PASSIVE"
    | "PROTOTYPING";
  modelUrl: string;
  mountStyle: "BREADBOARD_SNAP" | "DESK_FREE";
  boundingBox: [number, number, number]; // Unrotated [widthX, heightY, depthZ] in meters
  pins: PinDefinition[];
  model: ComponentElectricalModel;
  supportedProgramIds?: SafeId[];
}
```

### 4.2 Placement, Structural Snapshot, Faults, Current Flow & Frame Telemetry

```typescript
export type ComponentPlacement =
  | {
      kind: "DESK";
      position: [number, number, number];
      yawRad: number;
    }
  | {
      kind: "BREADBOARD";
      boardId: SafeId;
      anchorHole: HoleCoord;
      quarterTurns: 0 | 1 | 2 | 3; // Enforced 90-degree increments when snapped to breadboard
    };

export interface PlacedComponent {
  instanceId: SafeId;
  defId: SafeId;
  calibratedModelVersion: number;
  placement: ComponentPlacement;
}

export interface JumperWire {
  id: SafeId;
  from: PinRef;
  to: PinRef;
  color: string;
}

// Structural topology only — powerEnabled, inputStates, manualPins, and activeProgramId travel via dedicated RPC calls
export interface CircuitTopologySnapshot {
  components: PlacedComponent[];
  wires: JumperWire[];
}

// Order = tie-break order within a precedence level
export const FAULT_ORDER = [
  "DEAD_SHORT",
  "RAIL_CONTENTION",
  "GPIO_CONTENTION",
  "REVERSE_POLARITY",
  "OVER_VOLTAGE",
  "LED_OVERCURRENT",
  "PIN_OVERCURRENT",
  "NO_COMMON_GROUND",
  "FLOATING_PIN",
] as const;

export type CircuitFaultKind = (typeof FAULT_ORDER)[number];

// Lower number = higher precedence. A fault suppresses lower-precedence faults sharing its netId or instance (see §5.6.2).
export const FAULT_PRECEDENCE_LEVEL: Record<CircuitFaultKind, number> = {
  DEAD_SHORT: 0,
  RAIL_CONTENTION: 1,
  GPIO_CONTENTION: 1,
  REVERSE_POLARITY: 1,
  OVER_VOLTAGE: 2,
  LED_OVERCURRENT: 3,
  PIN_OVERCURRENT: 3,
  NO_COMMON_GROUND: 4,
  FLOATING_PIN: 4,
};

export interface CircuitFault {
  id: string;
  kind: CircuitFaultKind;
  severity: "ERROR" | "WARN";
  netId?: string;
  affectedInstanceIds: SafeId[];
  affectedPinAddresses: PinAddress[];
  message: string;
  remediation: string;
}

export type NetLogicLevel = "Z" | "LOW" | "HIGH" | "PWM";

export interface NetState {
  netId: string;
  voltage: number | null; // null on floating islands with no reference node
  logic: NetLogicLevel;
  pwmDuty: number; // 0..1
  freqHz: number;
  isShorted: boolean;
}

export type CurrentFlowRole = "POWER" | "SIGNAL" | "FAULT";

// Solver-internal. Never sent across the worker boundary; transport uses CurrentFlowDescriptor + flowCurrentsMa.
export interface CurrentFlowSegment {
  segmentId: string; // Wire ID or "<instanceId>:<pinA>-><pinB>"
  fromAddress: PinAddress;
  toAddress: PinAddress;
  currentMa: number; // Signed current from fromAddress -> toAddress
  direction: -1 | 0 | 1; // 0 when |currentMa| < 0.05 mA
  normalizedSpeed: number; // 0..1 log-scaled speed for pulse animation
  role: CurrentFlowRole;
}

// Emitted once per topology commit (not every simulation tick)
export interface NetDescriptor {
  topologyEpoch: number;
  netIndex: number;
  netId: string;
  pinAddresses: PinAddress[];
}

export interface CurrentFlowDescriptor {
  flowIndex: number;
  segmentId: string; // Wire ID, strip ID, or "<instanceId>:<pinA>-><pinB>"
  fromAddress: PinAddress;
  toAddress: PinAddress;
}

// Emitted once per topology commit (returned by loadTopology)
export interface TopologyDescriptor {
  topologyEpoch: number;
  nets: NetDescriptor[];
  flows: CurrentFlowDescriptor[];
  componentOrder: SafeId[]; // index into componentFlags / componentHeat
}

export const COMPONENT_FLAG = {
  BURNT: 1,
  OVERLOADED: 2,
  FLASHING: 4,
} as const;

export interface SimulationFrameOutput {
  topologyEpoch: number;
  simTimeSec: number;
  tickCount: number;
  powerActive: boolean;
  converged: boolean; // false if the LED iteration hit its cap
  netVoltages: Float32Array; // by NetDescriptor.netIndex; value is meaningless where netFloatingMask = 1
  netFloatingMask: Uint8Array; // 1 = floating island (no voltage)
  netLogicLevels: Uint8Array; // 0=Z, 1=LOW, 2=HIGH, 3=PWM
  netPwmDuties: Float32Array; // 0..1
  netFreqHz: Float32Array;
  flowCurrentsMa: Float32Array; // by CurrentFlowDescriptor.flowIndex, signed from -> to
  flowRoles: Uint8Array; // 0=POWER, 1=SIGNAL, 2=FAULT
  componentFlags: Uint8Array; // by TopologyDescriptor.componentOrder; COMPONENT_FLAG bits
  componentHeat: Float32Array; // 0..1
  componentOutputs?: Record<SafeId, Record<string, number | boolean>>; // only when changed
  faultEvents?: CircuitFault[]; // only on fault-set changes
}
```

### 4.3 Program & Manual Override Types (`src/types/program.ts`)

```typescript
export type ProgramPinDirection = "INPUT" | "OUTPUT" | "BIDIRECTIONAL";

export interface ProgramPinRequirement {
  role: SafeId;
  label: string;
  direction: ProgramPinDirection;
  preferredModes: GpioPinMode[];
  required: boolean;
}

export interface ProgramMeta {
  id: SafeId;
  name: string;
  description: string;
  supportedMcuKinds: ("AVR_SIM" | "ESP32_SIM" | "BEHAVIORAL")[];
  pinRequirements: ProgramPinRequirement[];
  snippet?: string;
}

export interface ManualPinOverride {
  pinAddress: PinAddress;
  mode: GpioPinMode;
  digitalHigh: boolean;
  pwmDuty: number; // 0..1
  freqHz?: number; // PWM frequency; default 1000 (use 50 for servo signals)
  active: boolean;
}

export interface ProgramRuntimeContext {
  simTimeSec: number;
  tickCount: number;
  readDigitalIn(addr: PinAddress): boolean;
  readAnalogIn(addr: PinAddress): number | null; // Volts or normalized reading
  writePinMode(addr: PinAddress, mode: GpioPinMode): void;
  writeDigitalOut(addr: PinAddress, high: boolean): void;
  writePwmOut(addr: PinAddress, duty01: number, freqHz?: number): void;
  pulseInUs(addr: PinAddress): number | null; // measured pulse width on a wired pin, in µs
}
```

---

## 5. Simulation Pipeline, Invalidation Tiers, Current Flow & Routing

### 5.1 Three-Tier Invalidation & Per-Tick Execution Order

1. **Tier 1 — Topology Commit (`loadTopology(snapshot)`):**
   - Triggered only on committed structural edits (component placed, drag pointer-up, component deleted, wire finalized/removed, or Undo/Redo)—never mid-drag or mid-wire preview.
   - Rebuilds DSU net equivalence (`buildNets`), constructs the net graph (nets as nodes; two-terminal parts, potentiometer halves, LEDs, sources, and actuator/sensor load models as edges) and the conductor graph (wires and breadboard strips, see §5.6.1), and emits one `TopologyDescriptor` (nets, current-flow descriptors, component order) per commit.
   - Prunes `burntInstanceIds`, `latchedOverloadIds`, and `damagedPinAddresses` for any `instanceId` removed from `snapshot.components`, while keeping intact parts restored on Undo unburnt.
2. **Tier 2 — Control / Input / Program Change (`setPower`, `setInputState`, `setManualPin`, `loadProgram`):**
   - Re-solves using the cached net graph without rebuilding DSU sets or net-graph edges.
   - When `powerEnabled` is `true`, components with `def.model.kind === "MCU"` implicitly energize their onboard `5V` and `3.3V` `POWER_OUT` rails; back-feeding an energized rail with a conflicting external supply triggers `RAIL_CONTENTION`.
3. **Tier 3 — Simulation Tick (`step(dtSec)`):**
   - Advances `simTimeSec` through a pure `step(dtSec)` core driven by a worker-side (non-`requestAnimationFrame`) timer. The timer wrapper clamps raw wall-clock `dt` to `<= 0.05s`, applies the speed multiplier (`{0.25, 0.5, 1, 2}`), then feeds a fixed-timestep accumulator: `FIXED_DT_SEC = 1/60`, max `MAX_SUBSTEPS = 8` catch-up steps per tick. Tests call `step()` directly.
   - **Strict Per-Tick Order (explicit 1-tick input feedback latency):**
     1. Step active program runtime (or apply manual GPIO pin overrides).
     2. Update pin drive modes/levels (`HIGH`, `LOW`, `PWM`, `Z`) and active source potentials.
     3. Solve DC network, piecewise-linear LEDs, branch currents, and `CurrentFlowSegment[]`.
     4. Sample simulated sensor/button/potentiometer inputs for the next tick (1-tick feedback latency).
     5. Integrate excess `I^2 * t` budgets (§5.6.5) and `0.2s` simulated-time warning flashes, updating latched `burntInstanceIds`, `latchedOverloadIds`, and `damagedPinAddresses`.

### 5.2 Non-Singular Solver & Piecewise-Linear LED Model

- **Dead Short Detection & Overload Latching:** `DEAD_SHORT` is emitted when either (a) a DSU pre-check finds a zero-resistance path between an active positive source/rail and `GND`, or (b) after solving, an active source's `V_terminal / I_source <= SHORT_OHM` (default `1 Ω`) while its current exceeds its rating (this catches `5V -> closed pushbutton -> GND`). It latches the source in `latchedOverloadIds` (cutting its output until `resetFaults()` or removal from the topology), preventing tick-by-tick on/off oscillation.
- **Connected Islands, Ground Reference & Finite Resistance:** Partition the net graph into connected islands **per solve** (open switches, `Z` pins, and off LEDs split islands). Reference and device-relative voltage rules are in §5.6.3. Islands with no reference net report `voltage = null` (flagged in `netFloatingMask`). Every voltage source, MCU rail, and active GPIO pin has finite `internalOhm` (e.g., `0.1Ω` supplies, `25Ω` GPIO). Every resistive edge is clamped to `MIN_OHM`, and open elements use `GMIN` (§5.6.4).
- **Piecewise-Linear LED Iteration:** Model each LED as off (open branch) or on (forward drop `vf` + `rdOhm`), iterating diode on/off states with a hard cap of **8 iterations** per solve until converged. If the cap is reached, keep the last LED states and set `converged = false` in the frame.
- **Fault Taxonomy:**
  - `DEAD_SHORT`: see above (latches source `TRIPPED`).
  - `RAIL_CONTENTION`: Two unequal voltage sources/rails tied to one net (including back-feeding an active MCU rail).
  - `GPIO_CONTENTION`: Two `GPIO` pins driving opposite logic levels (`HIGH` vs `LOW`) on the same net.
  - `REVERSE_POLARITY`: A `POWER_IN` pin (with `polarized !== false`) more negative than `-0.3 V` relative to its device `GND`, or a polarized supply wired backwards. Non-polarized parts (resistors, DC motors) never emit it.
  - `OVER_VOLTAGE`: Pin voltage (device-relative) exceeding `maxVoltage`; latches the component burnt immediately with no flash.
  - `LED_OVERCURRENT`: Forward LED current exceeding `imaxMa`; excess `I^2 * t` accumulates (§5.6.5), then flashes `0.2s` of sim time and latches burnt.
  - `PIN_OVERCURRENT`: Current exceeding `maxCurrentMa` on a `GPIO`, `POWER_OUT`, `POWER_IN`, or `GND` pin. On an MCU pin it adds the pin to `damagedPinAddresses`; elsewhere it follows §5.6.2.
  - `NO_COMMON_GROUND` (WARN): A driven signal net links two devices whose `GND` nets are not connected. The affected device input reads as `Z` while active.
  - `FLOATING_PIN` (WARN): An MCU input (`ANALOG_IN`, or `GPIO` in `INPUT` mode) referenced by the active program, or a device `SIGNAL_IN` with `requiredDriven: true` while powered, on an undriven net without pull-up/pull-down.

### 5.3 Animated Current Flow Visualization

When `powerEnabled` is `true`, `CurrentFlowOverlay.tsx` visualizes where current originates and where it travels:

- **Source-to-Sink Direction:** Signed branch currents (`CurrentFlowSegment`) point from higher potential (`V_high`) to lower potential (`V_low`) across jumper wires, breadboard strips, resistors, LEDs, and loads. Wire and strip currents come from the conductor-graph distribution in §5.6.1; component currents come from the nodal branch currents.
- **Instanced Directional Pulses:** An `InstancedMesh` renders glowing directional chevrons/beads distributed along active wire Bézier curves and component paths, advancing phase by `normalizedSpeed * deltaSimTime` inside `useFrame` (paused when `powerEnabled === false` or paused).
- **Semantic Color Coding:** Amber/gold for `POWER` delivery paths, cyan for `SIGNAL` / PWM paths, and crimson for `FAULT` / overcurrent branches.

### 5.4 Worker & Main-Thread Engine Contracts

```typescript
export interface IWorkerSimulationEngine {
  init(): Promise<void>;
  loadTopology(snapshot: CircuitTopologySnapshot): Promise<TopologyDescriptor>;
  loadProgram(programId: SafeId | null): Promise<void>;
  setPower(enabled: boolean): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  setSpeed(multiplier: number): Promise<void>;
  setInputState(
    instanceId: SafeId,
    controlId: SafeId,
    value: number | boolean,
  ): Promise<void>;
  setManualPin(override: ManualPinOverride): Promise<void>;
  resetFaults(instanceIds?: SafeId[]): Promise<void>;
  subscribeFrames(
    listener: (frame: SimulationFrameOutput) => void,
  ): Promise<number>;
  unsubscribeFrames(subscriptionId: number): Promise<void>;
  subscribeErrors(listener: (message: string) => void): Promise<number>;
  unsubscribeErrors(subscriptionId: number): Promise<void>;
  dispose(): Promise<void>;
}

// Main-thread facade: wraps callbacks in Comlink.proxy(), returns synchronous unsubscribe functions
export interface IEngineClient {
  init(): Promise<void>;
  loadTopology(snapshot: CircuitTopologySnapshot): Promise<TopologyDescriptor>;
  loadProgram(programId: SafeId | null): Promise<void>;
  setPower(enabled: boolean): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  setSpeed(multiplier: number): Promise<void>;
  setInputState(
    instanceId: SafeId,
    controlId: SafeId,
    value: number | boolean,
  ): Promise<void>;
  setManualPin(override: ManualPinOverride): Promise<void>;
  resetFaults(instanceIds?: SafeId[]): Promise<void>;
  onFrame(listener: (frame: SimulationFrameOutput) => void): () => void;
  onError(listener: (message: string) => void): () => void;
  dispose(): void;
}
```

- `step(dtSec)` lives on `BehavioralSimulationEngine` (pure, synchronous, used by tests and by the timer wrapper); it is intentionally not part of the RPC interface.
- `EngineClient` behavior is specified in §5.6.9.

### 5.5 Breadboard Grid, Rotated Bounds & Wire Routing

- **Canonical Hole Mapping (`breadboardGrid.ts`):** One pure module converts bidirectionally between `HoleCoord`, canonical `PinAddress` (`<boardId>:<region>:<col>:<row>`), and local 3D offsets across both main terminal strips and top/bottom power rails.
- **Hole Bounds & Strip Rules:** `MAIN`: `col` in `0..cols-1`, `row` in `0..2*rowsPerSide-1` (center gap splits rows into two sides). Rails (`TOP_POS`, `TOP_NEG`, `BOT_POS`, `BOT_NEG`): `col` in `0..railCols-1`, `row = 0`. A `MAIN` strip is the same `col` on the same side of the center gap. A rail strip is the same region within the same `railSegments` segment.
- **Breadboard Mounting:** Snapped parts use `placement: { kind: 'BREADBOARD', boardId, anchorHole, quarterTurns }`. Moving a breadboard moves all mounted parts automatically; deleting a breadboard detaches mounted parts to `DESK` placement and prunes invalid wires.
- **Wire Validation & Cache:** Reject self-connections, duplicate wires on the same endpoints, and multiple wire leads in the same breadboard hole. Cache `THREE.TubeGeometry` outside Zustand in `Map<string, THREE.TubeGeometry>` and invalidate/recompute routes using post-rotation world AABBs whenever a topology commit moves or adds obstacles. During a drag, wires attached to the moving part are redrawn live as simple quadratic curves from the moving endpoints (driven by `draftStore`); the obstacle-avoiding route and cache update happen on commit.

### 5.6 Solver Semantics (Normative)

This section is the normative source for solver, fault, timing, and transport behavior. RULES.md summarizes it.

#### 5.6.1 Conductor Graph & Current Distribution

- `buildNets()` also returns a **conductor graph**: one edge per `JumperWire` and one per breadboard strip. A strip is a chain through its _occupied_ holes in hole order. Each edge keeps its wire ID or strip ID.
- After each nodal solve, every pin has a signed injected current from the component edges attached to it. Per net, build a BFS spanning tree of the conductor graph; each tree edge carries the sum of injections in the subtree beyond it. Non-tree edges (wire loops) carry `0 mA` (documented approximation).
- Wire and strip `CurrentFlowSegment`s come from this step; component segments come from nodal branch currents.

#### 5.6.2 Fault Masking, Latch States & Burnt Behavior

- **Masking:** a fault suppresses lower-precedence faults (per `FAULT_PRECEDENCE_LEVEL`) that share its `netId` or any `affectedInstanceId`. Faults at the same level are all reported, ordered by `FAULT_ORDER`, then `instanceId`, then pin address.
- **Latch states (worker-only, never persisted):**
  - `latchedOverloadIds` (TRIPPED): source/rail cut-off. Cleared by `resetFaults()` or removal.
  - `burntInstanceIds` (BURNT): permanent damage. Cleared by `resetFaults()` or removal.
  - `damagedPinAddresses`: an MCU pin that exceeded its limit. The pin becomes `Z`; the instance is flagged `overloaded`, not `burnt`. Cleared by `resetFaults()` or removal of the instance.
- **Burnt electrical behavior:**

| Model kind                                                      | When burnt                      |
| :-------------------------------------------------------------- | :------------------------------ |
| `RESISTOR`, `LED`, `SWITCH`, `POTENTIOMETER`, `GENERIC_PASSIVE` | Open circuit on all edges       |
| `SOURCE`                                                        | Output removed (open)           |
| `MCU`                                                           | All GPIO `Z`; 5V/3.3V rails off |
| `ACTUATOR_*`, `SENSOR_ULTRASONIC`                               | No load, no outputs             |
| `BREADBOARD`                                                    | Never burns                     |

#### 5.6.3 Ground Reference & Device-Relative Levels

- **Reference net:** any net containing a `GND`-type pin, a `SOURCE.negPinId`, or an MCU `gndPinIds` entry. In each island, the reference net with the lowest `netIndex` is `0 V`; other GND nets are ordinary nodes.
- **Device-relative levels:** a pin's voltage and logic level (and `OVER_VOLTAGE` / `REVERSE_POLARITY` checks) use `V(pin) - V(owning device's GND net)`.
- **Signal inputs:** `SIGNAL_IN` pins connect to their device's GND net through `inputOhm` (default `100000`).
- **`NO_COMMON_GROUND`:** emitted when a driven signal net links two devices whose GND nets have no conductive path between them. While active, the affected device input reads as `Z`.

#### 5.6.4 Dead Short Threshold, Resistance Floors & GMIN

- `SHORT_OHM = 1`, `MIN_OHM = 1e-3` (clamp on every resistive edge, including `contactOhm` and potentiometer halves), `GMIN = 1e-9 S` (open switches, `Z` pins, off LEDs; matrix stability only).
- The potentiometer wiper fraction is clamped to `[0.001, 0.999]`.
- Floating islands are determined topologically, never by GMIN.
- Manifest validation requires every `ohms` / `totalOhms` / `contactOhm` to be finite and `> 0`.

#### 5.6.5 I²t Accumulation & Burn Sequence

- Limit per pin/part: `i2tLimitA2s ?? DEFAULT_I2T_FACTOR_S * (maxCurrentMa / 1000)^2`; `DEFAULT_I2T_LIMIT_A2S` applies only when no rating exists.
- Accumulator: `acc += max(0, I^2 - Imax^2) * dt`; when `I <= Imax`, `acc = max(0, acc - Imax^2 * dt)`.
- Sequence: limit crossed → `FLASHING` for `0.2 s` sim time → `BURNT`. `OVER_VOLTAGE` skips the flash.

#### 5.6.6 Timing Model & Program I/O

- PWM carries frequency: `writePwmOut(addr, duty01, freqHz?)` (default `1000`; servo signals use `50`).
- Servo angle is derived from pulse width `duty / freqHz`: `1.0–2.0 ms` maps to `minAngleDeg..maxAngleDeg`; clamp outside `0.5–2.5 ms`.
- Ultrasonic: if the trig net is `HIGH` for at least 1 tick while powered, the sensor sets an internal `echoWidthUs = distanceCm * 58` on its echo pin (`0` outside `minRangeCm..maxRangeCm`). Programs read it with `pulseInUs(addr)`, which returns a value only if the echo pin is actually wired to that MCU pin.
- Programs may read only `readDigitalIn`, `readAnalogIn`, and `pulseInUs`. There is no direct read of sensor/button state.

#### 5.6.7 Power & Time Lifecycle

- `setPower(true)`: starts the loop; resets program runtime and `simTimeSec` to `0`; keeps latched faults.
- `setPower(false)`: stops the loop; zeroes net states and outputs; resets program state; keeps latched faults.
- `pause()`: freezes time only (power stays on). Re-solve happens only on `setInputState` / `setManualPin`. `start()` resumes. Both have effect only while powered.
- `setSpeed()` accepts `{0.25, 0.5, 1, 2}`.

#### 5.6.8 Frame Transport & Solve Scheduling

- `loadTopology` returns a `TopologyDescriptor` once; frames carry only typed arrays plus change-only `faultEvents` / `componentOutputs`.
- The worker sends frames with `Comlink.transfer`; the main thread keeps only the latest frame (coalescing).
- Floating nets are signaled by `netFloatingMask`, never `NaN`. A real `NaN` is a solver bug and should raise `onError`.
- The engine re-solves only when marked dirty (topology, power, input, manual pin, program output, or fault-state change); nets with no edges are excluded from the matrix.

#### 5.6.9 `EngineClient` Lifecycle

- `onFrame` / `onError` return a local unsubscribe immediately. If called before the worker subscription id resolves, set a `cancelled` flag and unsubscribe as soon as the id arrives.
- `init()` caches its promise; `dispose()` is idempotent. The engine client is owned outside React (module singleton) so StrictMode double-mounts are safe.
- `setInputState` calls are coalesced into a latest-wins map keyed by `instanceId:controlId`, flushed once per animation frame.
- Comlink tests use a `MessageChannel` or the Comlink Node adapter, not mocks.

#### 5.6.10 Persistence Limits

- `MAX_COMPONENTS = 64`, `MAX_WIRES = 256`, `MAX_COMPRESSED_CHARS = 16000`, `MAX_JSON_CHARS = 96000`. Check the compressed length _before_ decompressing and the output length _after_.
- All numbers must be finite; desk positions within `±5 m`; wire `color` must match `/^#[0-9a-fA-F]{6}$/`.
- Use `.strict()` schemas and the ID regex on record keys.
- Share data goes in the URL hash; offer `.json` export when the link exceeds a safe length.

---

## 6. Recommended Folder Structure

```text
src/
├── types/
│   ├── circuit.ts               # SafeId, PinAddress, PinRef, ComponentDef, Placement, Faults
│   ├── program.ts               # Serializable ProgramMeta contract & manual pin override types
│   └── persistence.ts           # Versioned save schema, calibratedModelVersion & Zod schemas
├── registry/
│   ├── components/              # Pure TS manifests (no Three.js or React imports)
│   │   ├── breadboard830.ts
│   │   ├── arduinoUno.ts
│   │   ├── dcSupply.ts
│   │   ├── passives.ts          # Resistor, LED, Pushbutton (4-leg groups), Potentiometer
│   │   ├── esp32S3.ts
│   │   ├── sg90Servo.ts
│   │   ├── l298nDriver.ts
│   │   ├── dcMotor.ts
│   │   └── hcSr04Sensor.ts
│   └── programs/
│       ├── meta/                # Serializable program metadata & pin contracts
│       └── runtime/             # Worker-only fixed-dt program steppers
├── simulation/
│   ├── engineInterface.ts       # IWorkerSimulationEngine & IEngineClient
│   ├── unionFindNetlist.ts      # Pure buildNets() + net-graph edge builder
│   ├── dcNodalSolver.ts         # Finite-R island nodal solver, PWL LEDs & current flows
│   ├── faultValidator.ts        # Pure validate() + latched burnout & overload sets
│   ├── behavioralEngine.ts      # Phase 1 worker engine with 3-tier invalidation & fixed-dt
│   ├── engineClient.ts          # Main-thread Comlink client wrapping Comlink.proxy
│   └── worker.ts                # Comlink worker host off the main thread
├── store/
│   ├── useSandboxStore.ts       # Zustand + Zundo (partialized { placedComponents, wires })
│   ├── draftStore.ts            # Transient drag, wire preview, power, inputs & manual pins
│   ├── telemetryStore.ts        # Non-reactive TypedArray frame & ring-buffer oscilloscope store
│   └── engineBridge.ts          # Committed-topology & control RPC bridge to EngineClient
├── utils/
│   ├── manifestValidation.ts    # ID regex, unique pins, unit normals, AABB & model pin refs
│   ├── breadboardGrid.ts        # Canonical HoleCoord <-> PinAddress <-> local offset & hit-test
│   ├── wireValidation.ts        # Self-link, duplicate-wire & single-lead hole rules
│   ├── wireRouter.ts            # Rotated AABB clearance & cached TubeGeometry builder
│   └── persistenceCodec.ts      # schemaVersion migrations, Zod parse & lz-string share URLs
├── test/
│   └── fixtures.ts              # Test-only manifest factories (uncalibrated flag)
└── components/
    ├── workbench/
    │   ├── SandboxCanvas.tsx    # R3F Canvas, OrbitControls lock, renderer.info check
    │   ├── WorkbenchDesk.tsx    # Desk surface, ghost hole preview, placement & rotation
    │   ├── PlacedModule.tsx     # .glb loader (with modelScale), pin badges & scorch clone
    │   ├── JumperWireLayer.tsx  # Cached wire tubes, preview wire & pin-hover highlights
    │   ├── CurrentFlowOverlay.tsx # Instanced animated current pulses along active paths
    │   └── SmokeParticleVFX.tsx # Instanced smoke particles for fault/burnout events
    ├── hud/
    │   ├── ComponentDrawer.tsx  # Parts bin, power toggle, reset faults & program/manual pins
    │   ├── ProbeAndFaultPanel.tsx # Pin voltage/logic readout, fault fixes & oscilloscope
    │   └── ShareExportModal.tsx # BOM, pinout table & versioned save/share links
    └── devtools/
        └── PinCalibrator.tsx    # Dev tool with vertex snap, numeric nudge & JSON export
```

## Appendix A — Phase 2 Ports (Not Implemented)

```typescript
export interface SimulationEnginePorts {
  digital: {
    writePinMode(addr: PinAddress, mode: GpioPinMode): void;
    writeDigitalOut(addr: PinAddress, high: boolean): void;
    writePwmOut(addr: PinAddress, duty01: number): void;
    readPinVoltage(addr: PinAddress): number | null;
  };
  analog: {
    solveResistiveNetwork(snapshot: CircuitTopologySnapshot): {
      netVoltages: Float32Array;
      currentFlows: CurrentFlowSegment[];
    };
  };
}
```

Reserved for Phase 2 multi-domain co-simulation. Do not implement in Phase 1.
