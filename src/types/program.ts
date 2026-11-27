// ---------------------------------------------------------------------------
// src/types/program.ts — Program metadata, pin requirements & runtime context
//
// Verbatim from ARCHITECTURE.md §4.3.
// ---------------------------------------------------------------------------

import type { GpioPinMode, PinAddress, SafeId } from "./circuit";

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
