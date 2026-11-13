// ─────────────────────────────────────────────────────────────────────────────
// Types for the Modified Nodal Analysis (MNA) circuit engine.
// Supports linear (R, C, L, V, I) and non-linear (Diodes, LEDs, BJTs) components.
// ─────────────────────────────────────────────────────────────────────────────

export type ComponentFailureType =
  | "OVERPOWER"
  | "OVERVOLTAGE"
  | "OVERCURRENT"
  | "REVERSE_POLARITY"
  | "SHORT_CIRCUIT";

export interface ComponentFailure {
  componentId: string;
  failureType: ComponentFailureType;
  message: string;
  measuredValue: number;
  ratedValue: number;
  unit: string;
}

export interface BaseComponent {
  id: string;
  name: string;
}

export interface ResistorComponent extends BaseComponent {
  type: "resistor";
  pinA: string;
  pinB: string;
  resistance: number; // Ohms
  maxWatts?: number; // Rated power, default 0.25 W (1/4 W)
}

export interface CapacitorComponent extends BaseComponent {
  type: "capacitor";
  pinA: string; // Positive terminal for polarized capacitors
  pinB: string; // Negative terminal
  capacitance: number; // Farads
  maxVolts?: number; // Voltage rating, e.g. 16V, 50V
  isPolarized?: boolean;
  esr?: number; // Equivalent series resistance in Ohms
}

export interface InductorComponent extends BaseComponent {
  type: "inductor";
  pinA: string;
  pinB: string;
  inductance: number; // Henrys
  maxAmps?: number;
  seriesResistance?: number; // DCR in Ohms
}

export interface VoltageSourceComponent extends BaseComponent {
  type: "voltage_source";
  pinPos: string;
  pinNeg: string;
  voltage: number; // Volts
  internalResistance?: number; // Ohms, default 0.01 (near ideal)
  maxAmps?: number; // Current limit in Amps
}

export interface CurrentSourceComponent extends BaseComponent {
  type: "current_source";
  pinIn: string; // Current enters
  pinOut: string; // Current leaves
  current: number; // Amps
}

export interface DiodeComponent extends BaseComponent {
  type: "diode";
  pinAnode: string;
  pinCathode: string;
  forwardVoltage: number; // e.g. 0.7 for silicon, 2.0 for red LED
  maxCurrentAmps?: number; // e.g. 0.020 for standard 20mA LED
  maxReverseVoltage?: number; // Breakdown voltage, e.g. 50V
  isLed?: boolean;
  glowColor?: string;
}

export interface BjtComponent extends BaseComponent {
  type: "bjt";
  pinBase: string;
  pinCollector: string;
  pinEmitter: string;
  polarity: "NPN" | "PNP";
  beta: number; // Current gain hFE, e.g. 100
  vbeDrop?: number; // Base-emitter forward drop, default 0.7V
  vceSat?: number; // Collector-emitter saturation voltage, default 0.2V
  maxCollectorAmps?: number; // e.g. 0.8A for 2N2222
  maxBaseAmps?: number; // e.g. 0.05A
  maxWatts?: number; // e.g. 0.5W
}

export interface SwitchComponent extends BaseComponent {
  type: "switch";
  pinA: string;
  pinB: string;
  isClosed: boolean;
  closedResistance?: number; // e.g. 0.001 Ohms
  openResistance?: number; // e.g. 1e9 Ohms
}

export type CircuitComponent =
  | ResistorComponent
  | CapacitorComponent
  | InductorComponent
  | VoltageSourceComponent
  | CurrentSourceComponent
  | DiodeComponent
  | BjtComponent
  | SwitchComponent;

export interface NetConnection {
  netId: string;
  pins: string[]; // e.g. ["R1.A", "V1.POS"]
}

export interface CircuitNetlist {
  groundNetId: string; // e.g. "GND" or "0"
  components: CircuitComponent[];
  nets: NetConnection[];
}

export interface NodeOperatingPoint {
  netId: string;
  voltage: number; // Volts
}

export interface ComponentOperatingPoint {
  componentId: string;
  current: number; // Amps (magnitude or directional)
  voltageDrop: number; // Volts across component
  powerDissipated: number; // Watts
  state?: string; // e.g. "SATURATED", "ACTIVE", "CUTOFF", "CONDUCTING", "OFF"
  brightness?: number; // For LEDs: 0..1+
}

export interface MnaSimulationResult {
  converged: boolean;
  iterations: number;
  nodeVoltages: Record<string, number>;
  componentStates: Record<string, ComponentOperatingPoint>;
  failures: ComponentFailure[];
  details: string[]; // Calculation steps for display in CalcPanel
}

