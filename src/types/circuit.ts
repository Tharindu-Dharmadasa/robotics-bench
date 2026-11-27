// ---------------------------------------------------------------------------
// src/types/circuit.ts — Core sandbox types and constants
//
// Verbatim from ARCHITECTURE.md §4.1, §4.2, §5.6.4, and §5.6.5.
// This file has ZERO imports. No logic, no validation, no functions.
// ---------------------------------------------------------------------------

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

// §5.6.4 — Dead short threshold, resistance floors & GMIN
export const SHORT_OHM = 1;
export const MIN_OHM = 1e-3; // Clamp on every resistive edge
export const GMIN = 1e-9; // Siemens — open switches, Z pins, off LEDs; matrix stability only

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
  pitchMeters: number; // Meters
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
  nominalVoltage: number; // Volts
  maxCurrentMa: number; // mA
  internalOhm: number; // Ω
  i2tLimitA2s?: number; // A²·s
}

export interface PowerInPinDef extends BasePinDefinition {
  type: "POWER_IN";
  nominalVoltage: number; // Volts
  maxVoltage: number; // Volts
  polarized?: boolean; // default true; false for polarity-insensitive inputs
  maxCurrentMa: number; // mA
  i2tLimitA2s?: number; // A²·s
}

export interface GndPinDef extends BasePinDefinition {
  type: "GND";
  maxCurrentMa: number; // mA
  internalOhm: number; // Ω
  i2tLimitA2s?: number; // A²·s
}

export interface GpioPinDef extends BasePinDefinition {
  type: "GPIO";
  logicHighV: number; // e.g., 5.0 for Uno, 3.3 for ESP32
  maxVoltage: number; // Volts
  maxCurrentMa: number; // mA
  internalOhm: number; // Ω
  allowedModes: GpioPinMode[];
  defaultMode: GpioPinMode;
  pullupOhm?: number; // INPUT_PULLUP series resistance; default 35000
  i2tLimitA2s?: number; // A²·s
}

export interface AnalogInPinDef extends BasePinDefinition {
  type: "ANALOG_IN";
  maxVoltage: number; // Volts
}

export interface PassivePinDef extends BasePinDefinition {
  type: "PASSIVE";
  maxVoltage?: number; // Volts
}

export interface SignalPinDef extends BasePinDefinition {
  type: "SIGNAL_IN" | "SIGNAL_OUT";
  nominalVoltage: number; // Volts
  maxVoltage: number; // Volts
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
      vf: number; // Volts — forward voltage drop
      imaxMa: number; // mA — maximum forward current
      rdOhm: number; // Ω — dynamic on-resistance
      i2tLimitA2s?: number; // defaults to DEFAULT_I2T_FACTOR_S * (imaxMa / 1000)^2
    }
  | {
      kind: "SWITCH";
      pinA: SafeId;
      pinB: SafeId;
      normallyClosed?: boolean;
      contactOhm: number; // Ω
    }
  | {
      kind: "POTENTIOMETER";
      pinA: SafeId;
      wiperPinId: SafeId;
      pinB: SafeId;
      totalOhms: number; // Ω
    }
  | {
      kind: "SOURCE";
      posPinId: SafeId;
      negPinId: SafeId;
      volts: number; // Volts
      maxMa: number; // mA
      internalOhm: number; // Ω
    }
  | {
      kind: "MCU";
      architecture: "AVR_SIM" | "ESP32_SIM" | "BEHAVIORAL";
      logicHighV: number; // Volts
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
      nominalV: number; // Volts
      loadOhm: number; // Ω
      maxMa: number; // mA
    }
  | {
      kind: "ACTUATOR_DC_MOTOR";
      pinA: SafeId;
      pinB: SafeId;
      nominalV: number; // Volts
      loadOhm: number; // Ω
      maxMa: number; // mA
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
      maxSupplyV: number; // Volts
      dropoutV: number; // Volts
      maxChannelMa: number; // mA
      loadOhm: number; // Ω
      i2tLimitA2s?: number; // A²·s
    }
  | {
      kind: "SENSOR_ULTRASONIC";
      trigPinId: SafeId;
      echoPinId: SafeId;
      vccPinId: SafeId;
      gndPinId: SafeId;
      nominalV: number; // Volts
      loadOhm: number; // Ω
      maxMa: number; // mA
      minRangeCm: number; // cm
      maxRangeCm: number; // cm
      defaultDistanceCm: number; // cm
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

// ---------------------------------------------------------------------------
// §4.2 — Placement, Structural Snapshot, Faults, Current Flow & Frame Telemetry
// ---------------------------------------------------------------------------

export type ComponentPlacement =
  | {
      kind: "DESK";
      position: [number, number, number]; // Meters
      yawRad: number; // Radians
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
  currentMa: number; // Signed current from fromAddress -> toAddress (mA)
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
  simTimeSec: number; // Simulated seconds
  tickCount: number;
  powerActive: boolean;
  converged: boolean; // false if the LED iteration hit its cap
  netVoltages: Float32Array; // by NetDescriptor.netIndex; value is meaningless where netFloatingMask = 1
  netFloatingMask: Uint8Array; // 1 = floating island (no voltage)
  netLogicLevels: Uint8Array; // 0=Z, 1=LOW, 2=HIGH, 3=PWM
  netPwmDuties: Float32Array; // 0..1
  netFreqHz: Float32Array;
  flowCurrentsMa: Float32Array; // by CurrentFlowDescriptor.flowIndex, signed from -> to (mA)
  flowRoles: Uint8Array; // 0=POWER, 1=SIGNAL, 2=FAULT
  componentFlags: Uint8Array; // by TopologyDescriptor.componentOrder; COMPONENT_FLAG bits
  componentHeat: Float32Array; // 0..1
  componentOutputs?: Record<SafeId, Record<string, number | boolean>>; // only when changed
  faultEvents?: CircuitFault[]; // only on fault-set changes
}
