// src/customLab/customTypes.ts

/**
 * Types for custom experiment sandbox components.
 */
export type CustomComponentType =
  | "led_red"
  | "led_green"
  | "res_220"
  | "res_10"
  | "res_10k"
  | "button"
  | "npn_2n2222"
  | "diode_1n4007"
  | "sg90_servo"
  | "oled_i2c";

/** Placement of a custom part on the breadboard. */
export interface PlacedCustomPart {
  id: string; // unique identifier
  type: CustomComponentType;
  name: string; // human‑readable label
  gridCol: number; // column index (1‑30)
  gridRow: "top" | "bottom"; // which half of the board
  /** Optional value, e.g. resistance or capacitor value */
  value?: string;
}

/** A wire connecting two pins. */
export interface CustomWire {
  id: string; // unique identifier for the wire
  fromPinId: string; // id of source pin (partId:pinName)
  toPinId: string; // id of destination pin
  color: string; // hex or css colour for rendering
}

/** Result of a simulation step. */
export interface CustomSimResult {
  status: "IDLE" | "RUNNING" | "FAULT";
  faultMessage?: string;
  burnedPartIds: string[]; // parts that burned out
  shortedWireIds: string[]; // wires that caused a short circuit
  activeWireIds: string[]; // wires currently carrying current
  litLedIds: string[]; // LED part ids that are on
  /** Brightness per LED id (0‑1 range) */
  ledBrightness: Record<string, number>;
  servoActive: boolean;
  oledActive: boolean;
  /** Voltage string per node id, e.g. "5.00V" or "FLOATING" */
  nodeVoltages: Record<string, string>;
  logs: string[]; // textual log messages for the UI
}
