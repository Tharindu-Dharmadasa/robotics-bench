# Robotics Bench — Sandbox Step-by-Step Implementation Plan

This plan orders work by risk: lock down types, canonical grid math, and the pure solver/validator with Vitest fixtures first; add the pin calibrator and vertical slice of components; build snapping, procedural wires, and animated current flow; and finish with burnout VFX, full hardware catalog, diagnostics, and persistence.

---

## Phase 1: Core Types, Pure Solver & Worker Bridge (Vitest First)

### Task 1.1 — Dependencies, Folders & ESLint Import Guards

- Install `zustand`, `zundo`, `immer`, `comlink`, `idb-keyval`, `lz-string`, and `zod`, plus `vitest` and `fast-check` as dev dependencies. Tests use Comlink's Node adapter.
- Create `src/types/`, `src/registry/components/`, `src/registry/programs/meta/`, `src/registry/programs/runtime/`, `src/simulation/`, `src/store/`, `src/utils/`, `src/components/workbench/`, `src/components/hud/`, and `src/components/devtools/`.
- Configure ESLint `no-restricted-imports` with glob patterns (`**/simulation/unionFindNetlist*`, `**/simulation/dcNodalSolver*`, `**/simulation/faultValidator*`, `**/simulation/behavioralEngine*`) covering `src/components/**`, `src/store/**`, and `src/utils/**`, plus a rule blocking `three` and `react` inside `src/types/**`, `src/registry/**`, `src/simulation/**`, `src/utils/breadboardGrid.ts`, `src/utils/manifestValidation.ts`, and `src/utils/wireValidation.ts`.
- Add a second ESLint zone rule (`import/no-restricted-paths` or `eslint-plugin-boundaries`) forbidding `src/types/**`, `src/registry/**`, and `src/simulation/**` from importing `**/store/**`, `**/components/**`, `zustand`, `zundo`, and `idb-keyval`.
- **Acceptance Criteria:** `npm run build`, ESLint boundary checks, and `npx vitest --run` pass with zero errors.

### Task 1.2 — Core Data Models, Canonical Grid Math & Test Factories

- Implement `src/types/circuit.ts` (`SafeId`, `PinAddress`, `PinRef`, `GridSpec`, discriminated `PinDefinition` union, `ComponentElectricalModel` including `POTENTIOMETER`, `ACTUATOR_DC_MOTOR`, full `ACTUATOR_MOTOR_DRIVER` pin mapping/H-bridge specs, `SENSOR_ULTRASONIC` range/echo specs, and `i2tLimitA2s` on LED/pin definitions with `DEFAULT_I2T_LIMIT_A2S`, `ComponentPlacement` union, `CircuitTopologySnapshot`, `CircuitFault`, `topologyEpoch`-tagged `NetDescriptor` & `SimulationFrameOutput`, `CurrentFlowSegment`(solver-internal),`CurrentFlowDescriptor`, `TopologyDescriptor`, `COMPONENT_FLAG`, `FAULT_ORDER`, and `FAULT_PRECEDENCE_LEVEL`).
- Implement `src/types/program.ts` (serializable `ProgramMeta`, `ProgramPinRequirement`, `ManualPinOverride`, and `ProgramRuntimeContext`) and `src/types/persistence.ts` (`schemaVersion`, `calibratedModelVersion`, and `zod` schemas with payload size caps).
- Implement `src/simulation/engineInterface.ts` (`IWorkerSimulationEngine`, `IEngineClient`).
- Implement `src/utils/breadboardGrid.ts` (single canonical converter between `HoleCoord`, `PinAddress`, and local 3D offsets across main strips and rails, plus rotated AABB math) and `src/utils/manifestValidation.ts` (ID regex `/^[a-zA-Z0-9_-]+$/`, unique pin IDs, unit normals, pin bounds check, model pin reference checks, finite and `> 0` values for all `ohms` / `totalOhms` / `contactOhm`, and `GridSpec` rail checks where `railSegments` must sum to `railCols`).
- Create test-only manifest factories in `src/test/fixtures.ts` with an `uncalibrated` flag accepted by `manifestValidation.ts`.
- **Acceptance Criteria:** Vitest tests pass for ID/manifest validation, `HoleCoord <-> PinAddress` round-trips, `90°` rotated bounds, and hole-bounds and strip-membership tests for `MAIN` and rail regions.

### Task 1.3 — DSU Net Builder (`unionFindNetlist.ts`)

- Implement `buildNets()` using DSU over `PinAddress` keys strictly for zero-resistance conductors (breadboard strips/rails, `JumperWire` endpoints, internal pin groups such as 4-leg pushbutton pairs, and derived breadboard-snapped component pins), keeping `SWITCH` elements out of DSU merges and modeling them as resistive edges (`contactOhm`) in the net graph alongside two-terminal parts, loads, and potentiometer halves. Also return a conductor graph (one edge per wire and per breadboard strip chained through occupied holes) per ARCHITECTURE §5.6.1.
- **Acceptance Criteria:** Vitest tests pass for multi-pin nets, open/closed resistive switches without DSU mutation, breadboard rail/strip bridging, and series/parallel net-graph edges, and conductor-graph fixtures (wire/strip edges preserved with IDs).

### Task 1.4 — Finite-Resistance DC Nodal Solver & Current Flow (`dcNodalSolver.ts`)

- Implement `solveDcNetwork()` with finite-resistance source/pin modeling, resistive `SWITCH` conductance updates, connected island partitioning (`voltage = null` on floating islands), piecewise-linear LED state iteration (capped at `8` iterations), branch current calculation, and `CurrentFlowSegment[]` direction/speed output, reference-net selection and device-relative voltages (§5.6.3), `MIN_OHM` / `GMIN` / wiper clamping (§5.6.4), conductor-graph current distribution (§5.6.1), and converged reporting.
- **Acceptance Criteria:** Vitest fixtures pass for: (a) `5V -> 220Ω resistor -> LED -> GND` (valid forward current and `POWER` flow direction), (b) reversed LED (blocks forward current), (c) parallel LEDs with different `Vf`, (d) two series resistors splitting voltage, (e) floating island with no ground (`voltage = null`, no `NaN`), and (f) closed vs. open pushbutton switching current without rebuilding DSU nets, (g) a 3-pin net with two wires satisfies KCL at every node and a looped net carries 0 mA on non-tree edges, (h) `5V -> closed pushbutton -> GND` is classified as a short via the resistance threshold, and (i) a potentiometer at 0% and 100% produces finite voltages with no `NaN`.

### Task 1.5 — Fault Validator, Latching & Fixed-Step Engine (`faultValidator.ts` & `behavioralEngine.ts`)

- Implement `validate()` and `BehavioralSimulationEngine` with the three invalidation tiers (`loadTopology` incrementing `topologyEpoch`, control updates keying implicit MCU rails on `model.kind === "MCU"`, and a non-`requestAnimationFrame` fixed-timestep loop with `FIXED_DT_SEC = 1 / 60`, `dt <= 0.05s` clamp, speed multiplier, `MAX_SUBSTEPS = 8` catch-up cap, `start()`, `pause()`, and `setSpeed()`), deterministic fault precedence, `I^2 * t` / `0.2s` simulated-time fault flash, and latched `burntInstanceIds` / `latchedOverloadIds` surviving net rebuilds until removed or reset. Also implement a pure `step(dtSec)` core separate from the timer wrapper, speed multiplier handling (§5.1/§5.6.7), fault masking and `damagedPinAddresses` (§5.6.2), burnt electrical behavior, and the excess I²t accumulator (§5.6.5).
- **Acceptance Criteria:** Vitest fixtures verify: (a) `5V -> GND` -> `DEAD_SHORT` + latched source overload (no tick oscillation across rebuilds), (b) `5V -> LED -> GND` -> `LED_OVERCURRENT` (LED) + `PIN_OVERCURRENT` (driving pin) in deterministic precedence and latched `burnt`, (c) `GPIO HIGH -> GND` -> `PIN_OVERCURRENT`, (d) `5V` tied to `3.3V` -> `RAIL_CONTENTION`, (e) `GPIO HIGH` tied to `GPIO LOW` -> `GPIO_CONTENTION`, (f) voltage > `maxVoltage` -> `OVER_VOLTAGE`, (g) undriven `INPUT` pin -> `FLOATING_PIN`, and (h) burnt/overload states survive net rebuilds until deleted or `resetFaults()` (i) `DEAD_SHORT` suppresses `PIN_OVERCURRENT` on the same net, (j) `NO_COMMON_GROUND` makes the device input read `Z`, (k) `setPower(false)` stops the loop and keeps latched faults while `setPower(true)` resets program state and `simTimeSec`, and (l) a 1 A pin at 2x rated current burns in about 0.4 s of simulated time via `step()`.

### Task 1.6 — Comlink Worker & `EngineClient` Proxy Bridge

- Implement `src/simulation/worker.ts` and `src/simulation/engineClient.ts` wrapping frame and error listeners in `Comlink.proxy(...)` with explicit worker-side unsubscribe (`subscribeFrames` / `unsubscribeFrames`, `subscribeErrors` / `unsubscribeErrors`) and `dispose()` cleanup so no `Comlink.proxy` callbacks leak, plus `src/store/telemetryStore.ts` (`Float32Array`/`Uint8Array` frame buffers, `topologyEpoch` mismatch dropping, and ring-buffered oscilloscope samples).
- **Acceptance Criteria:** In-process engine tests and Comlink wrapper tests (using a `MessageChannel` or the Comlink Node adapter) verify proxied frame/error callbacks, stale `topologyEpoch` frame dropping, unsubscribe proxy release (including unsubscribe before the subscription id resolves), idempotent `init()` / `dispose()`, `TopologyDescriptor` delivery, transferred typed-array frames, and latest-wins coalescing of `setInputState`. End Phase 1 with a headless integration test of a blink-LED circuit through the real worker.

---

## Phase 2: Pin Calibrator & Vertical Slice of Components

### Task 2.0 — Asset Intake

- Place models in `public/models/<defId>.glb` and track source and license for each in `public/models/ASSETS.md`.
- Compress with gltf-transform/meshopt and set a triangle and file-size budget per model.
- Generate pin positions procedurally for passives on the 2.54 mm pitch; reserve the calibrator for modules (Uno, ESP32-S3, L298N, HC-SR04, SG90).
- **Acceptance Criteria:** every manifest's `modelUrl` resolves, every asset is logged with a license, and no model exceeds its budget.

### Task 2.1 — 3D Pin Calibrator Dev Tool (`src/components/devtools/PinCalibrator.tsx`)

- Build an isolated calibration tool for `.glb` assets supporting raycast surface picking, **snap-to-nearest-mesh-vertex**, numeric `X/Y/Z` nudge inputs, normal vector editing, `modelScale` preview, and JSON/TypeScript `PinDefinition[]` export.
- **Acceptance Criteria:** Picking a pin on a `.glb`, snapping/nudging coordinates numerically, and exporting produces valid TypeScript matching `src/types/circuit.ts`.

### Task 2.2 — Vertical Slice Manifests (`arduinoUno`, `dcSupply`, `breadboard830`, `passives`)

- Create calibrated manifests in `src/registry/components/` for `breadboard830.ts` (procedural grid from `GridSpec`), `dcSupply.ts`, `arduinoUno.ts`, and `passives.ts` (`220Ω` resistor, `1kΩ` resistor, LED, 4-leg pushbutton, potentiometer).
- **Acceptance Criteria:** `manifestValidation.test.ts` passes for all vertical-slice manifests with `uncalibrated = false`.

---

## Phase 3: Workbench Scene, Snapping, Procedural Wires & Animated Current Flow

### Task 3.1 — Store-to-Worker Bridge, Zustand + Zundo Store & Persistence Codec

- Implement `src/store/useSandboxStore.ts` (`zundo` `partialize` on `{ placedComponents, wires }`), `src/store/draftStore.ts` (in-flight drag coordinates, wire preview, `powerEnabled`, `inputStates`, manual GPIO pins), and `src/store/engineBridge.ts` (the bridge that sends committed topology snapshots and control RPCs to `EngineClient`, with latest-wins coalescing for `setInputState`).
- Implement `src/utils/persistenceCodec.ts` (`schemaVersion`, migrations, `zod` validation with size caps, `validateTopologyIntegrity` checking `defId`, `boardId`, `HoleCoord` bounds, and `pinId` references, `calibratedModelVersion` drift warning, and `lz-string` share URLs).
- **Acceptance Criteria:** Unit tests confirm drags/potentiometer updates do not flood undo history, Undo/Redo re-evaluates topology cleanly, and invalid, oversized, or referentially broken share links (`unknown defId`, invalid `boardId`, out-of-bounds `HoleCoord`, unknown `pinId`) are rejected before reaching the worker.

### Task 3.2 — Workbench Scene, Hole Occupancy Preview & Breadboard Snapping

- Implement `SandboxCanvas.tsx` (standard depth buffer, `camera.near = 0.002`, `camera.far <= 20`, `polygonOffset`, and scale-aware hit/snap radii) and `WorkbenchDesk.tsx` with `OrbitControls` lock during direct manipulation, parts bin placement, desk overlap prevention, `R` / `90°` (`quarterTurns`) rotation, green/red breadboard hole-occupancy ghost preview, and breadboard move/delete handling. Also build the minimal `ComponentDrawer.tsx` (parts bin and power toggle) and the `PlacedModule.tsx` shell (`.glb` load with `modelScale`) here, so placement and power can be exercised before Phase 4.
- **Acceptance Criteria:** Snapping a part at `0°` and `90°` aligns pins to holes with live green/red occupancy feedback without near-plane clipping, moving a breadboard moves mounted parts, and deleting a breadboard detaches parts cleanly, with no near-plane clipping or z-fighting at 90° and 0° placements.

### Task 3.3 — Wire Validation & Procedural 3D Jumper Wires (`JumperWireLayer.tsx`)

- Implement `src/utils/wireValidation.ts` (reject self-connections, duplicate wires, and multiple leads in one breadboard hole) and `src/utils/wireRouter.ts` (Bézier/catenary curves clearing rotated AABBs, cached in `Map<string, THREE.TubeGeometry>` outside Zustand and invalidated on topology commits). Wires attached to a dragged part redraw live as quadratic curves from `draftStore`; full routing and cache invalidation occur on commit.
- **Acceptance Criteria:** Valid pin-to-pin clicks generate non-intersecting 3D wires; invalid connections are blocked with clear feedback; deleting wires disposes only owned wire geometries.

### Task 3.4 — Animated Current Flow Overlay (`CurrentFlowOverlay.tsx`)

- Render instanced directional pulses (`InstancedMesh`) along active wires and component paths from `telemetryStore` (`TopologyDescriptor.flows` for geometry, plus `flowCurrentsMa` and `flowRoles` per frame), advancing phase by `simTimeSec` in `useFrame` and coloring pulses by role (`POWER`, `SIGNAL`, `FAULT`).
- **Acceptance Criteria:** Turning power on displays directional pulses flowing from source/HIGH pins to return/GND; turning power off or pausing freezes the flow cleanly.

---

## Phase 4: Remaining Hardware, Burnout VFX, HUD & Sharing

### Task 4.1 — Remaining Component Manifests, Pre-Built Programs & Manual Pin Driver

- Implement H-bridge (`ACTUATOR_MOTOR_DRIVER`) and ultrasonic echo (`SENSOR_ULTRASONIC`) behavioral evaluation in the solver/engine, with Vitest fixtures (forward/reverse/brake motor current; echo width in µs versus distance in cm within tolerance, and zero outside min/max range), `pulseInUs` for ultrasonic echo and `freqHz` on PWM writes/overrides (servo angle from pulse width), `NO_COMMON_GROUND` and device `requiredDriven` handling, and pause/speed controls (`{0.25, 0.5, 1, 2}`) in `ComponentDrawer.tsx`.
- Add calibrated manifests for `esp32S3.ts`, `sg90Servo.ts`, `l298nDriver.ts`, `dcMotor.ts`, and `hcSr04Sensor.ts`.
- Add serializable `ProgramMeta` (`pinRequirements`) and `ProgramRuntimeContext` worker runtimes for `blink`, `servoSweep`, `motorControl`, and `sonar`, plus a **Manual GPIO Pin Driver** (`ManualPinOverride` using `GpioPinMode`: `INPUT`/`INPUT_PULLUP`/`OUTPUT_DIGITAL`/`OUTPUT_PWM`) and read-only firmware code snippet viewer in `ComponentDrawer.tsx` / `PlacedModule.tsx` (with MCU pin wiring badges).
- **Acceptance Criteria:** All hardware manifests pass validation, pre-built programs and manual GPIO toggles drive outputs end-to-end, and MCU pins display required wiring badges.

### Task 4.2 — Burnout VFX, Diagnostics Panel, BOM Export & Frame Budget Check

- Implement `SmokeParticleVFX.tsx` (instanced smoke) and per-instance cloned scorched/glowing materials in `PlacedModule.tsx`, plus a "Reset Faults / Burnt Parts" button.
- Implement `ProbeAndFaultPanel.tsx` (logic level + voltage readout, fault diagnostics with fix steps, oscilloscope waveform) and `ShareExportModal.tsx` (Bill of Materials, pinout table, IndexedDB save/load, share URLs).
- Run a `renderer.info` frame-budget and GPU disposal check with ~12 components and ~60 wires active. Targets: sim tick ≤ 2 ms, 60 fps with ~12 components and ~60 wires, draw calls under a documented ceiling, and zero geometry/material leaks via `renderer.info`.
- Add Playwright flows for snap-to-breadboard, wire creation, power on/off, and undo/redo.
- **Acceptance Criteria:** Faults display smoke/scorch VFX and actionable fixes, resetting restores parts, BOM/share links round-trip cleanly, and `renderer.info` confirms zero geometry/material leaks.
