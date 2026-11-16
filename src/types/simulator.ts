export type Kind =
  | "dip"
  | "qfp"
  | "usb"
  | "usbc"
  | "jack"
  | "xtal"
  | "btn"
  | "hdr"
  | "cap"
  | "ecap"
  | "led"
  | "ws2812"
  | "res"
  | "reg"
  | "fuse"
  | "jumper"
  | "to92"
  | "diode"
  | "relay"
  | "screw"
  | "transducer"
  | "esp32"
  | "ultrasonic"
  | "motorDriver"
  | "stepperDriver"
  | "servo"
  | "imu"
  | "encoder"
  | "oled";

/** How a missing or mis-configured part manifests on the bench. */
export type FaultSeverity = "halt" | "burnout" | "degraded";

/** One causal consequence triggered by removing or re-valuing a part. */
export interface PartEffect {
  severity: FaultSeverity;
  /** Serial monitor message printed when the effect fires (shown in red). */
  message: string;
  /** Optional id of another part that visually burns out as a result. */
  damagedPartId?: string;
}

export interface Part {
  id: string;
  name: string;
  kind: Kind;
  smd: boolean;
  p: [number, number];
  n?: number;
  rot?: number;
  color?: string;
  label?: string;
  /** Printed / nominal value, e.g. "1kΩ", "16MHz", "500mA". */
  value?: string;
  /** Editable value choices offered in the parts inspector. */
  valueOptions?: string[];
  /** What happens when this part is removed while the board is powered. */
  onRemoveEffect?: PartEffect;
  /** What happens when the configured value is changed; keyed by the option string. */
  valueEffects?: Record<string, PartEffect>;
}

export interface FaultRule {
  id: string;
  label: string;
  cause: string;
  effect: string;
  /** Serial monitor message printed when the fault fires (shown in red). */
  errorMessage: string;
  /** Part that visually burns out / smokes when the fault is active. */
  criticalPart: string;
  /** Part ids that must be present, or the board faults automatically on power-on. */
  criticalParts?: string[];
}

export type SimStatus =
  | "BARE PCB"
  | "ASSEMBLING"
  | "NEEDS SOLDER"
  | "READY"
  | "RUNNING"
  | "FAULT";

/** A run of plain or bold text used by the About panel. */
export interface DescriptionSegment {
  text: string;
  bold?: boolean;
}

export interface BoardSpec {
  id: number;
  name: string;
  subtitle: string;
  description: DescriptionSegment[];
  code: string;
  parts: Part[];
  faultRule: FaultRule | null;
  /** Physical base-plate style rendered by <Pcb/> (falls back to a generic board). */
  boardStyle?:
    | "uno-notched"
    | "breadboard"
    | "perfboard"
    | "devkit-narrow"
    | "hc-sr04"
    | "l298n-red"
    | "stepstick"
    | "sg90-cutaway"
    | "breakout-blue"
    | "ky040-dark"
    | "pca9685-blue"
    | "oled-module"
    | "fusion-purple";
}
