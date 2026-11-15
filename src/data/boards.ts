import type { BoardSpec, Part } from "../types/simulator";

export const PCB_T = 0.16;

export const COLORS: Record<string, string> = {
  Blue: "#1f6fb2",
  Red: "#b8322a",
  Green: "#2f7d46",
  Black: "#1d1d1d",
  White: "#e9e9e4",
};

const UNO_PARTS: Part[] = [
  {
    id: "u3",
    name: "ATmega16U2",
    kind: "qfp",
    smd: true,
    p: [-1.6, 0.4],
    label: "USB CHIP",
  },
  {
    id: "reg",
    name: "5V regulator",
    kind: "reg",
    smd: true,
    p: [-2.2, -1.3],
  },
  {
    id: "ledon",
    name: "ON LED",
    kind: "led",
    smd: true,
    p: [1.6, 0.9],
    color: "#3dff6a",
    label: "ON",
  },
  {
    id: "ledl",
    name: "L LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.5],
    color: "#ffb020",
    label: "L (pin 13)",
  },
  {
    id: "ledtx",
    name: "TX LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.05],
    color: "#ffb020",
  },
  {
    id: "ledrx",
    name: "RX LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.25],
    color: "#ffb020",
  },
  { id: "c1", name: "100nF cap", kind: "cap", smd: true, p: [0.3, 0.3] },
  { id: "c2", name: "100nF cap", kind: "cap", smd: true, p: [-0.6, -0.1] },
  { id: "r1", name: "1k resistor", kind: "res", smd: true, p: [-0.5, 1.5] },
  { id: "r2", name: "10k resistor", kind: "res", smd: true, p: [1.2, 0.5] },
  {
    id: "mcu",
    name: "ATmega328P",
    kind: "dip",
    smd: false,
    p: [1.0, -1.0],
    label: "ATmega328P",
  },
  {
    id: "usb",
    name: "USB-B port",
    kind: "usb",
    smd: false,
    p: [-3.05, 1.4],
    label: "USB-B",
  },
  {
    id: "jack",
    name: "DC barrel jack",
    kind: "jack",
    smd: false,
    p: [-3.0, -1.8],
    label: "DC JACK",
  },
  {
    id: "xtal",
    name: "16 MHz crystal",
    kind: "xtal",
    smd: false,
    p: [-0.3, -0.9],
    label: "16MHz",
  },
  {
    id: "rst",
    name: "Reset button",
    kind: "btn",
    smd: false,
    p: [-2.6, 2.1],
    label: "RESET",
  },
  {
    id: "hd1",
    name: "Digital header 0-7",
    kind: "hdr",
    smd: false,
    p: [2.0, 2.4],
    n: 8,
    label: "DIGITAL",
  },
  {
    id: "hd2",
    name: "Digital header 8-13",
    kind: "hdr",
    smd: false,
    p: [-0.4, 2.4],
    n: 10,
  },
  {
    id: "hp",
    name: "Power header",
    kind: "hdr",
    smd: false,
    p: [-0.2, -2.4],
    n: 8,
    label: "POWER",
  },
  {
    id: "ha",
    name: "Analog header",
    kind: "hdr",
    smd: false,
    p: [2.0, -2.4],
    n: 6,
    label: "ANALOG",
  },
  {
    id: "icsp",
    name: "ICSP header",
    kind: "hdr",
    smd: false,
    p: [3.1, -0.2],
    n: 3,
    rot: Math.PI / 2,
  },
  {
    id: "icsp2",
    name: "ICSP2 header",
    kind: "hdr",
    smd: false,
    p: [-1.6, 1.9],
    n: 3,
  },
  { id: "e1", name: "47µF cap", kind: "ecap", smd: false, p: [-2.1, -0.5] },
  { id: "e2", name: "47µF cap", kind: "ecap", smd: false, p: [-1.6, -0.5] },
  { id: "fuse", name: "Polyfuse", kind: "fuse", smd: false, p: [-2.6, 0.5] },
];

const BLINK_CODE = `// Blink — the "hello world" of hardware
void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT); // pin 13
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("LED OFF");
  delay(500);
}`;

export const BOARD_SPECS: BoardSpec[] = [
  {
    id: 1,
    name: "Arduino Uno R3",
    subtitle: "meet the board",
    description: [
      { text: "The " },
      { text: "Arduino Uno R3", bold: true },
      { text: " is the classic starter board: an " },
      { text: "ATmega328P", bold: true },
      { text: " running at " },
      { text: "16 MHz", bold: true },
      {
        text: ", 14 digital I/O pins (6 PWM), 6 analog inputs and a second chip (ATmega16U2) that turns USB into serial. Power it from USB or the 7–12 V barrel jack. Pin 13 drives the onboard ",
      },
      { text: "L", bold: true },
      { text: " LED — perfect for your first blink." },
    ],
    code: BLINK_CODE,
    parts: UNO_PARTS,
    faultRule: {
      id: "led-overcurrent",
      label: "Blown L LED",
      cause:
        "Pin 13 sourcing more current than the onboard LED can survive without a current-limiting resistor.",
      effect:
        "The L LED fades out and dies; the sketch keeps running with no visible heartbeat.",
    },
  },
  {
    id: 2,
    name: "LED + resistor",
    subtitle: "Ohm's law",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 3,
    name: "Transistor switch",
    subtitle: "logic drives power",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 4,
    name: "ESP32-S3 DevKit",
    subtitle: "WiFi + two cores",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 5,
    name: "Ultrasonic sensor",
    subtitle: "echo ranging",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 6,
    name: "L298N driver",
    subtitle: "H-bridge, why not",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 7,
    name: "A4988 stepper driver",
    subtitle: "microstepping",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 8,
    name: "SG90 servo",
    subtitle: "PWM angle",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 9,
    name: "MPU-6050 IMU",
    subtitle: "accel + gyro",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 10,
    name: "Rotary encoder",
    subtitle: "quadrature",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 11,
    name: "PCA9685 servo board",
    subtitle: "16 PWM over I2C",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 12,
    name: "I2C OLED display",
    subtitle: "128x64 pixels",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
  {
    id: 13,
    name: "MPU-6050 IMU",
    subtitle: "sensor fusion",
    description: [],
    code: "",
    parts: [],
    faultRule: null,
  },
];

export const BOARDS: [string, string][] = BOARD_SPECS.map((b) => [
  b.name,
  b.subtitle,
]);
