export type Kind =
  | "dip"
  | "qfp"
  | "usb"
  | "jack"
  | "xtal"
  | "btn"
  | "hdr"
  | "cap"
  | "ecap"
  | "led"
  | "res"
  | "reg"
  | "fuse"
  | "esp32"
  | "ultrasonic"
  | "motorDriver"
  | "stepperDriver"
  | "servo"
  | "imu"
  | "encoder"
  | "oled";

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
}

export interface FaultRule {
  id: string;
  label: string;
  cause: string;
  effect: string;
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
}
