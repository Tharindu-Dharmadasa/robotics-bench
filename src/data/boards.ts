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
    onRemoveEffect: {
      severity: "halt",
      message:
        "USB-SERIAL LINK DEAD: the 16U2 is the USB↔UART bridge — D+/D− never become RX/TX. The sketch still runs from flash, but uploads and the serial monitor are cut; only an ICSP programmer can talk to the board now.",
    },
  },
  {
    id: "reg",
    name: "5V regulator",
    kind: "reg",
    smd: true,
    p: [-2.2, -1.3],
    value: "NCP1117-5.0",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "VIN PATH UNREGULATED: without the NCP1117, 7–12 V from the barrel jack reaches the 5 V rail raw. The ATmega328P is a 5 V part — anything above 6 V slowly cooks it. On USB power the rail survives (the polyfuse path feeds 5 V directly), so expect resets and damage only on jack power.",
    },
  },
  {
    id: "ledon",
    name: "ON LED",
    kind: "led",
    smd: true,
    p: [1.6, 0.9],
    color: "#3dff6a",
    label: "ON",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "POWER INDICATOR OUT: the ON LED hangs straight off the 5 V rail through a 1 kΩ SMD resistor. Removing it changes nothing electrically — the board runs fine — you just lose the visual confirmation that the rail is alive.",
    },
  },
  {
    id: "ledl",
    name: "L LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.5],
    color: "#ffb020",
    label: "L (pin 13)",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "PIN-13 HEARTBEAT GONE: Blink's output is invisible. The ATmega keeps toggling pin 13 at full speed, but with no LED to sink the current you can no longer tell a running sketch from a frozen one.",
    },
  },
  {
    id: "ledtx",
    name: "TX LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.05],
    color: "#ffb020",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "TX TRAFFIC INVISIBLE: the transmit LED taps the 16U2's TX line through a 1 kΩ limiter. Serial bytes still flow to USB — you just can't see activity on the wire.",
    },
  },
  {
    id: "ledrx",
    name: "RX LED",
    kind: "led",
    smd: true,
    p: [-0.9, 1.25],
    color: "#ffb020",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "RX TRAFFIC INVISIBLE: the receive LED taps the 16U2's RX line through a 1 kΩ limiter. Incoming bytes still reach the MCU — incoming traffic is just silent on the board.",
    },
  },
  {
    id: "c1",
    name: "100nF cap",
    kind: "cap",
    smd: true,
    p: [0.3, 0.3],
    value: "100nF",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "RAIL SPIKES UNCAPPED: every ATmega328P output transition dumps a ~10 ns current spike into the 5 V rail; C1 is the local charge reservoir that supplies it. Without it the rail sags on each edge — ADC readings jitter and heavy loads can brown-out-reset the MCU.",
    },
  },
  {
    id: "c2",
    name: "100nF cap",
    kind: "cap",
    smd: true,
    p: [-0.6, -0.1],
    value: "100nF",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "USB CLOCK NOISE: the 16U2 runs a 16 MHz PLL off the same rail; without its local 100 nF decoupling cap, PLL jitter shows up as corrupted USB frames — the serial monitor prints garbage bytes or drops the port entirely.",
    },
  },
  {
    id: "r1",
    name: "1k resistor",
    kind: "res",
    smd: true,
    p: [-0.5, 1.5],
    value: "1kΩ",
    valueOptions: ["1kΩ (Safe)", "10Ω (Too Low)", "100kΩ (Too High)"],
    valueEffects: {
      "10Ω (Too Low)": {
        severity: "burnout",
        damagedPartId: "ledl",
        message:
          "OVERCURRENT (300 mA): with a 10 Ω limiter the L LED sees (5 V − 2 V) / 10 Ω ≈ 300 mA — 15× its 20 mA rating and far past the pin's 40 mA absolute max. The junction burns out in seconds.",
      },
      "100kΩ (Too High)": {
        severity: "degraded",
        message:
          "STARVED LED: (5 V − 2 V) / 100 kΩ ≈ 30 µA — a hundredth of the 3 mA design current. The L LED glows too dim to see and Blink appears to do nothing.",
      },
    },
    onRemoveEffect: {
      severity: "burnout",
      damagedPartId: "ledl",
      message:
        "OVERCURRENT ON PIN 13: with the 1 kΩ limiter gone, the L LED clamps the pin at ~2 V and the ATmega dumps (5 V − 2 V) straight into the junction — well past the 40 mA per-pin absolute maximum. The LED cooks within seconds.",
    },
  },
  {
    id: "r2",
    name: "10k resistor",
    kind: "res",
    smd: true,
    p: [1.2, 0.5],
    value: "10kΩ",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "RESET LINE FLOATING: RST is no longer held high. The line drifts near the logic threshold, so noise and the DTR coupling from the 16U2 randomly pulse it — the board resets at unpredictable intervals and uploads fail mid-flash.",
    },
  },
  {
    id: "mcu",
    name: "ATmega328P",
    kind: "dip",
    smd: false,
    p: [1.0, -1.0],
    label: "ATmega328P",
    onRemoveEffect: {
      severity: "halt",
      message:
        "SKETCH EXECUTION HALTED: the 328P is the board's only brain — no CPU, no GPIO, no ADC. The 5 V rail still comes up and the ON LED still lights, but nothing runs and the 16U2 has nothing left to talk to.",
    },
  },
  {
    id: "usb",
    name: "USB-B port",
    kind: "usb",
    smd: false,
    p: [-3.05, 1.4],
    label: "USB-B",
    onRemoveEffect: {
      severity: "halt",
      message:
        "USB POWER + SERIAL CUT: 5 V from the host and the D+/D− lanes both enter here. With the connector gone the board only runs from the barrel jack, and programming requires an ICSP programmer — the classic 'board won't upload' fault.",
    },
  },
  {
    id: "jack",
    name: "DC barrel jack",
    kind: "jack",
    smd: false,
    p: [-3.0, -1.8],
    label: "DC JACK",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "DC INPUT LOST: the 7–12 V wall-adapter path is gone. The board now lives or dies by USB 5 V alone — fine on the bench, but any project meant to run from a battery or adapter is dead.",
    },
  },
  {
    id: "xtal",
    name: "16 MHz crystal",
    kind: "xtal",
    smd: false,
    p: [-0.35, -0.5],
    label: "16MHz",
    value: "16MHz",
    valueOptions: ["16MHz", "8MHz", "0MHz (Faulty)"],
    valueEffects: {
      "8MHz": {
        severity: "degraded",
        message:
          "CLOCK HALVED: every timing primitive scales with F_CPU — delay(500) now takes a full second and Blink drops to half tempo. Worse, 9600 baud serial is now clocked off-spec, so the monitor prints mojibake like 'LÃˆD ON'.",
      },
      "0MHz (Faulty)": {
        severity: "halt",
        damagedPartId: "mcu",
        message:
          "NO CLOCK: a dead crystal leaves the CPU with no oscillation — the sketch freezes mid-instruction and the board looks powered but never responds.",
      },
    },
    onRemoveEffect: {
      severity: "halt",
      damagedPartId: "mcu",
      message:
        "CLOCKS STOPPED: the ATmega328P is fused to ignore its internal 8 MHz RC oscillator and trusts the external crystal only. No crystal → no oscillation → the CPU never leaves reset and the sketch never starts.",
    },
  },
  {
    id: "rst",
    name: "Reset button",
    kind: "btn",
    smd: false,
    p: [-2.6, 2.1],
    label: "RESET",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "MANUAL RESET GONE: the button is just a switch across RST–GND. With it gone the line still idles high through the 10 kΩ pull-up and DTR auto-reset still works — you only lose the big friendly way to restart the sketch by hand.",
    },
  },
  {
    id: "hd1",
    name: "Digital header 0-7",
    kind: "hdr",
    smd: false,
    p: [2.0, 2.4],
    n: 8,
    label: "DIGITAL",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "PINS 0–7 UNREACHABLE: this female header is the only copper from ATmega port PD0–PD7 to the outside world. Shields and jumpers connected there now float — inputs read noise, outputs go nowhere.",
    },
  },
  {
    id: "hd2",
    name: "Digital header 8-13",
    kind: "hdr",
    smd: false,
    p: [-0.4, 2.4],
    n: 10,
    onRemoveEffect: {
      severity: "degraded",
      message:
        "PINS 8–13 UNREACHABLE: PWM 9/10/11, the SPI taps (D10–D13) and pin 13's external leg all route through this block; remove it and every shield on the digital half loses its signals and its ground.",
    },
  },
  {
    id: "hp",
    name: "Power header",
    kind: "hdr",
    smd: false,
    p: [-0.2, -2.4],
    n: 8,
    label: "POWER",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "POWER TAPS GONE: 5 V, 3V3, GND, Vin and A0–A5 surface only here. Breadboarded sensors lose their supply and the analog inputs float — the board itself keeps running.",
    },
  },
  {
    id: "ha",
    name: "Analog header",
    kind: "hdr",
    smd: false,
    p: [2.0, -2.4],
    n: 6,
    label: "ANALOG",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "ANALOG INPUTS CUT: A0–A5 reach the outside world only through this header; without it the ADC mux reads floating channels — every analogRead() returns noise.",
    },
  },
  {
    id: "icsp",
    name: "ICSP header",
    kind: "hdr",
    smd: false,
    p: [3.1, -0.2],
    n: 3,
    rot: Math.PI / 2,
    onRemoveEffect: {
      severity: "degraded",
      message:
        "IN-SYSTEM PROGRAMMING LOST: the MISO/MOSI/SCK/RESET/VCC taps are gone. If the bootloader is ever erased, re-flashing now means pulling the chip and using a socket programmer.",
    },
  },
  {
    id: "icsp2",
    name: "ICSP2 header",
    kind: "hdr",
    smd: false,
    p: [-1.6, 1.9],
    n: 3,
    onRemoveEffect: {
      severity: "degraded",
      message:
        "USB CHIP FIRMWARE LOCKED: this second header re-flashes the ATmega16U2's own firmware. Without it, a corrupted USB-serial converter can no longer be repaired in-circuit.",
    },
  },
  {
    id: "e1",
    name: "47µF cap",
    kind: "ecap",
    smd: false,
    p: [-2.1, -0.5],
    value: "47µF",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "LOW-FREQUENCY SAG: the 100 nF caps handle nanosecond spikes, but only bulk electrolytics ride through millisecond load steps. Without E1 the 5 V rail ripples with regulator recovery — expect LED flicker and ADC drift under load.",
    },
  },
  {
    id: "e2",
    name: "47µF cap",
    kind: "ecap",
    smd: false,
    p: [-1.6, -0.5],
    value: "47µF",
    onRemoveEffect: {
      severity: "degraded",
      message:
        "INPUT RIPPLE UNFILTERED: E2 sits on the regulator's input side to soak up rectified DC ripple. Remove it and the 16 MHz clock jitters and the ADC reference wanders as the rail bounces with every wall-adapter cycle.",
    },
  },
  {
    id: "fuse",
    name: "Polyfuse",
    kind: "fuse",
    smd: false,
    p: [-2.6, 0.5],
    value: "500mA",
    valueOptions: ["500mA (Safe)", "100mA (Too Sensitive)", "Bypassed (No Protection)"],
    valueEffects: {
      "100mA (Too Sensitive)": {
        severity: "degraded",
        message:
          "NUISANCE TRIPS: a 100 mA polyfuse trips during ordinary operation (USB enumeration + LED drive). The 5 V rail collapses, the board resets, and it works again only after cooling down.",
      },
      "Bypassed (No Protection)": {
        severity: "degraded",
        message:
          "NO OVERCURRENT GUARD: a shorted shield or back-fed project now pulls unlimited current from the host port until the PC's own protection trips — the board itself survives, your USB port may not.",
      },
    },
    onRemoveEffect: {
      severity: "halt",
      message:
        "5V FEED CUT: the polyfuse is the series element between USB VBUS and the 5 V rail. Remove it and USB power never reaches the regulator, op-amp or MCU — the board is dead unless the barrel jack is plugged in.",
    },
  },
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
      errorMessage: "Overcurrent on pin 13 — the onboard L LED burned out.",
      criticalPart: "ledl",
    },
  },
  {
    id: 2,
    name: "LED + resistor",
    subtitle: "Ohm's law",
    description: [
      { text: "The bench's simplest lab: a " },
      { text: "5 mm red LED", bold: true },
      { text: " fed from " },
      { text: "5 V", bold: true },
      { text: " through a " },
      { text: "330 Ω", bold: true },
      {
        text: " current-limiting resistor. The resistor sets the current to roughly 10 mA — leave it out and the LED burns out in a flash.",
      },
    ],
    code: `// LED blink through a 330Ω limiter
const int LED = 9;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(LED, LOW);
  Serial.println("LED OFF");
  delay(500);
}`,
    parts: [
      {
        id: "led2",
        name: "5mm red LED",
        kind: "led",
        smd: false,
        p: [-1.4, 0.2],
        color: "#ff4136",
        label: "LED",
      },
      {
        id: "r1",
        name: "330Ω resistor",
        kind: "res",
        smd: true,
        p: [0.2, -0.9],
      },
      {
        id: "sw1",
        name: "Tactile switch",
        kind: "btn",
        smd: false,
        p: [0.9, 1.2],
        label: "SW1",
      },
      {
        id: "hdr1",
        name: "Header 4-pin",
        kind: "hdr",
        smd: false,
        p: [-2.4, -2.0],
        n: 4,
      },
    ],
    faultRule: {
      id: "led-burnout",
      label: "LED burnout",
      cause:
        "The LED is driven straight from 5 V with no current-limiting resistor in series.",
      effect:
        "The junction flashes bright, cooks and dies; the circuit reads open.",
      errorMessage: "Overcurrent on the LED leg — junction burned out.",
      criticalPart: "led2",
      criticalParts: ["r1"],
    },
  },
  {
    id: 3,
    name: "Transistor switch",
    subtitle: "logic drives power",
    description: [
      { text: "A " },
      { text: "2N2222 NPN", bold: true },
      { text: " switches the load, not the pin: a small " },
      { text: "base current", bold: true },
      { text: " controls a much larger collector current through the " },
      { text: "LED", bold: true },
      {
        text: ". A digital pin can only source ~20 mA — transistors do the heavy lifting.",
      },
    ],
    code: `// NPN low-side switch: base resistor drives Q1
const int BASE = 7;

void setup() {
  pinMode(BASE, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(BASE, HIGH);
  Serial.println("LOAD ON");
  delay(800);
  digitalWrite(BASE, LOW);
  Serial.println("LOAD OFF");
  delay(800);
}`,
    parts: [
      {
        id: "q1",
        name: "2N2222 NPN",
        kind: "btn",
        smd: false,
        p: [-1.2, 0.4],
        label: "Q1",
      },
      {
        id: "rb",
        name: "10kΩ base resistor",
        kind: "res",
        smd: true,
        p: [0.3, 1.0],
      },
      {
        id: "rl",
        name: "1kΩ collector resistor",
        kind: "res",
        smd: true,
        p: [0.3, 0.2],
      },
      {
        id: "led2",
        name: "5mm red LED",
        kind: "led",
        smd: false,
        p: [1.7, -0.6],
        color: "#ff4136",
        label: "LOAD",
      },
      {
        id: "hdr1",
        name: "Header 6-pin",
        kind: "hdr",
        smd: false,
        p: [-2.4, -2.0],
        n: 6,
      },
    ],
    faultRule: {
      id: "q1-open",
      label: "Open transistor",
      cause:
        "Base drive beyond the HFE rating cooks the collector-emitter junction until it fails open.",
      effect: "The load LED never lights even with the base driven high.",
      errorMessage: "Q1 collector-emitter junction failed open.",
      criticalPart: "q1",
      criticalParts: ["rb"],
    },
  },
  {
    id: 4,
    name: "ESP32-S3 DevKit",
    subtitle: "WiFi + two cores",
    description: [
      { text: "The " },
      { text: "ESP32-S3", bold: true },
      { text: " is a dual-core " },
      { text: "240 MHz", bold: true },
      {
        text: " MCU with Wi-Fi and BLE on board. EN and BOOT buttons plus a USB-C port make it the most capable devkit on the bench.",
      },
    ],
    code: `// ESP32-S3: Wi-Fi RSSI + core heartbeat
void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
  Serial.println("core 0 alive — RSSI -52 dBm");
  delay(400);
  digitalWrite(2, LOW);
  delay(400);
}`,
    parts: [
      {
        id: "esp32",
        name: "ESP32-S3 module",
        kind: "esp32",
        smd: false,
        p: [0, 0.2],
        label: "ESP32-S3",
      },
      {
        id: "c1",
        name: "10µF decoupling cap",
        kind: "cap",
        smd: true,
        p: [-1.8, 1.1],
      },
      {
        id: "rst",
        name: "EN button",
        kind: "btn",
        smd: false,
        p: [-1.7, -1.7],
        label: "EN",
      },
      {
        id: "boot",
        name: "BOOT button",
        kind: "btn",
        smd: false,
        p: [-1.7, -1.2],
        label: "BOOT",
      },
      {
        id: "ledpwr",
        name: "PWR LED",
        kind: "led",
        smd: true,
        p: [1.5, 1.3],
        color: "#3dff6a",
      },
      {
        id: "hdr1",
        name: "GPIO header",
        kind: "hdr",
        smd: false,
        p: [2.2, -2.0],
        n: 8,
      },
    ],
    faultRule: {
      id: "brownout",
      label: "Brown-out",
      cause:
        "The 3V3 regulator sags when the radio transmits at full power without its decoupling cap.",
      effect: "The chip resets in a loop; Wi-Fi never comes up.",
      errorMessage: "Brown-out detected — 3V3 rail sagged below 2.8 V.",
      criticalPart: "esp32",
      criticalParts: ["c1"],
    },
  },
  {
    id: 5,
    name: "Ultrasonic sensor",
    subtitle: "echo ranging",
    description: [
      { text: "The " },
      { text: "HC-SR04", bold: true },
      { text: " pings a " },
      { text: "40 kHz", bold: true },
      {
        text: " ultrasonic burst and times the echo: distance = speed of sound × time ÷ 2. Useful range is roughly 2 cm to 4 m.",
      },
    ],
    code: `// HC-SR04: pulseIn echo ranging
const int TRIG = 5;
const int ECHO = 18;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long cm = pulseIn(ECHO, HIGH) / 58;
  Serial.println("distance: " + String(cm) + " cm");
  delay(200);
}`,
    parts: [
      {
        id: "sonar",
        name: "HC-SR04",
        kind: "ultrasonic",
        smd: false,
        p: [-0.5, 0.3],
        label: "HC-SR04",
      },
      {
        id: "hdr1",
        name: "Header 4-pin",
        kind: "hdr",
        smd: false,
        p: [-2.4, -1.9],
        n: 4,
      },
      {
        id: "c1",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [1.6, 1.0],
      },
      {
        id: "r1",
        name: "10kΩ pull-up",
        kind: "res",
        smd: true,
        p: [1.6, 0.3],
      },
    ],
    faultRule: {
      id: "echo-timeout",
      label: "Echo timeout",
      cause:
        "The transducer pair is overdriven past its rated voltage and detunes.",
      effect: "The echo never returns; every ping times out at 25 ms.",
      errorMessage: "HC-SR04 echo timeout — no return pulse.",
      criticalPart: "sonar",
      criticalParts: ["c1"],
    },
  },
  {
    id: 6,
    name: "L298N driver",
    subtitle: "H-bridge, why not",
    description: [
      { text: "The " },
      { text: "L298N", bold: true },
      { text: " is a dual " },
      { text: "H-bridge", bold: true },
      {
        text: " driver: two full bridges steer up to 2 A per channel, so the MCU never carries motor current directly. Big electrolytics soak up the switching spikes.",
      },
    ],
    code: `// L298N: forward / reverse / stop
const int ENA = 9;
const int IN1 = 7;
const int IN2 = 8;

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  analogWrite(ENA, 180);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  Serial.println("motor: forward 180");
  delay(1500);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  Serial.println("motor: reverse");
  delay(1500);
}`,
    parts: [
      {
        id: "hbridge",
        name: "L298N driver",
        kind: "motorDriver",
        smd: false,
        p: [-0.2, 0.2],
        label: "L298N",
      },
      {
        id: "e1",
        name: "100µF cap",
        kind: "ecap",
        smd: false,
        p: [1.9, 1.2],
      },
      {
        id: "e2",
        name: "100µF cap",
        kind: "ecap",
        smd: false,
        p: [-2.0, 1.2],
      },
      {
        id: "hdr1",
        name: "Control header",
        kind: "hdr",
        smd: false,
        p: [-2.4, -2.0],
        n: 6,
      },
      {
        id: "leda",
        name: "Fault LED",
        kind: "led",
        smd: true,
        p: [2.2, -1.1],
        color: "#ffb020",
      },
    ],
    faultRule: {
      id: "overtemp",
      label: "H-bridge overtemp",
      cause:
        "The driver runs past its 25 W dissipation limit with the bulk caps missing.",
      effect: "Thermal shutdown latches the outputs high-Z until it cools.",
      errorMessage: "L298N thermal shutdown — outputs latched high-Z.",
      criticalPart: "hbridge",
      criticalParts: ["e1"],
    },
  },
  {
    id: 7,
    name: "A4988 stepper driver",
    subtitle: "microstepping",
    description: [
      { text: "The " },
      { text: "A4988", bold: true },
      { text: " drives one bipolar stepper with up to " },
      { text: "1/16 microstepping", bold: true },
      {
        text: ". The VREF trimpot sets the coil current limit — set it too high and the driver latches into fault protection.",
      },
    ],
    code: `// A4988: step one revolution, 700 µs pulses
const int STEP = 3;
const int DIR = 4;

void setup() {
  pinMode(STEP, OUTPUT);
  pinMode(DIR, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(DIR, HIGH);
  for (int i = 0; i < 200; i++) {
    digitalWrite(STEP, HIGH);
    delayMicroseconds(700);
    digitalWrite(STEP, LOW);
    delayMicroseconds(700);
  }
  Serial.println("stepped one revolution");
  delay(500);
}`,
    parts: [
      {
        id: "stepper",
        name: "A4988 carrier",
        kind: "stepperDriver",
        smd: false,
        p: [-0.4, 0.2],
        label: "A4988",
      },
      {
        id: "e1",
        name: "100µF cap",
        kind: "ecap",
        smd: false,
        p: [1.8, 1.2],
      },
      {
        id: "r1",
        name: "VREF trim resistor",
        kind: "res",
        smd: true,
        p: [-1.8, 1.1],
      },
      {
        id: "hdr1",
        name: "Motor header",
        kind: "hdr",
        smd: false,
        p: [1.9, -1.9],
        n: 4,
      },
      {
        id: "led2",
        name: "Fault LED",
        kind: "led",
        smd: true,
        p: [-2.2, -1.2],
        color: "#ffb020",
      },
    ],
    faultRule: {
      id: "vref-over",
      label: "VREF overcurrent",
      cause:
        "The current-limit trimpot is set above the motor's rated coil current.",
      effect: "The driver latches into fault and the motor skips steps.",
      errorMessage: "A4988 overcurrent lockout — VREF set too high.",
      criticalPart: "stepper",
      criticalParts: ["r1"],
    },
  },
  {
    id: 8,
    name: "SG90 servo",
    subtitle: "PWM angle",
    description: [
      { text: "The " },
      { text: "SG90", bold: true },
      { text: " positions its horn with " },
      { text: "50 Hz PWM", bold: true },
      {
        text: " pulses between 500 µs and 2500 µs. Inside, a potentiometer closes the feedback loop that holds the commanded angle.",
      },
    ],
    code: `// SG90: 50 Hz PWM, 500–2500 µs pulses
#include <Servo.h>
Servo s1;

void setup() {
  s1.attach(9, 500, 2500);
  Serial.begin(9600);
}

void loop() {
  s1.write(20);
  Serial.println("angle: 20°");
  delay(700);
  s1.write(160);
  Serial.println("angle: 160°");
  delay(700);
}`,
    parts: [
      {
        id: "servo1",
        name: "SG90 micro servo",
        kind: "servo",
        smd: false,
        p: [0.4, 0.4],
        label: "SG90",
      },
      {
        id: "hdr1",
        name: "Signal header",
        kind: "hdr",
        smd: false,
        p: [-2.3, -1.9],
        n: 3,
      },
      {
        id: "c1",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [-1.5, 1.0],
      },
      {
        id: "r1",
        name: "1kΩ gate resistor",
        kind: "res",
        smd: true,
        p: [-1.5, 0.2],
      },
    ],
    faultRule: {
      id: "servo-stall",
      label: "Servo stall",
      cause:
        "The horn is jammed against the end stop while the PWM keeps driving.",
      effect:
        "Stall current cooks the winding; the servo twitches and then dies.",
      errorMessage: "SG90 stall — motor winding burned out.",
      criticalPart: "servo1",
      criticalParts: ["c1"],
    },
  },
  {
    id: 9,
    name: "MPU-6050 IMU",
    subtitle: "accel + gyro",
    description: [
      { text: "The " },
      { text: "MPU-6050", bold: true },
      { text: " pairs a 3-axis " },
      { text: "accelerometer", bold: true },
      { text: " with a 3-axis " },
      { text: "gyroscope", bold: true },
      {
        text: " on one I2C chip — the classic motion-sensing starter part. Both I2C lines need pull-ups.",
      },
    ],
    code: `// MPU-6050: raw accel + gyro over I2C
#include <Wire.h>

void setup() {
  Wire.begin();
  Wire.beginTransmission(0x68);
  Wire.write(0x6B);
  Wire.write(0); // wake up
  Wire.endTransmission(true);
  Serial.begin(9600);
}

void loop() {
  Wire.beginTransmission(0x68);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(0x68, 4);
  int ax = Wire.read() << 8 | Wire.read();
  int ay = Wire.read() << 8 | Wire.read();
  Serial.println("ax:" + String(ax) + " ay:" + String(ay));
  delay(200);
}`,
    parts: [
      {
        id: "imu1",
        name: "MPU-6050",
        kind: "imu",
        smd: false,
        p: [0, 0.4],
        label: "MPU-6050",
      },
      {
        id: "r1",
        name: "4.7kΩ pull-up SDA",
        kind: "res",
        smd: true,
        p: [1.6, 1.0],
      },
      {
        id: "r2",
        name: "4.7kΩ pull-up SCL",
        kind: "res",
        smd: true,
        p: [1.6, 0.3],
      },
      {
        id: "c1",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [-1.7, 1.1],
      },
      {
        id: "hdr1",
        name: "I2C header",
        kind: "hdr",
        smd: false,
        p: [-2.3, -1.9],
        n: 4,
      },
    ],
    faultRule: {
      id: "i2c-nack",
      label: "I2C NACK",
      cause:
        "Missing pull-ups let the SDA line float mid-transfer and the bus wedges.",
      effect:
        "Every read NACKs until both lines are clocked out by hand.",
      errorMessage: "I2C NACK — MPU-6050 bus locked up.",
      criticalPart: "imu1",
      criticalParts: ["r1", "r2"],
    },
  },
  {
    id: 10,
    name: "Rotary encoder",
    subtitle: "quadrature",
    description: [
      { text: "An " },
      { text: "EC11 rotary encoder", bold: true },
      { text: " outputs two " },
      { text: "quadrature", bold: true },
      {
        text: " square waves 90° out of phase. Reading their order tells you rotation and direction; the shaft also pushes like a button.",
      },
    ],
    code: `// EC11: quadrature decode on interrupt
const int A = 2;
const int B = 3;
volatile long count = 0;

void isr() {
  if (digitalRead(B) == HIGH) count++;
  else count--;
}

void setup() {
  pinMode(A, INPUT_PULLUP);
  pinMode(B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(A), isr, FALLING);
  Serial.begin(9600);
}

void loop() {
  Serial.println("encoder: " + String(count));
  delay(150);
}`,
    parts: [
      {
        id: "enc1",
        name: "EC11 encoder",
        kind: "encoder",
        smd: false,
        p: [-0.8, 0.3],
        label: "EC11",
      },
      {
        id: "sw1",
        name: "Push switch",
        kind: "btn",
        smd: false,
        p: [1.7, 1.3],
        label: "SW",
      },
      {
        id: "c1",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [-1.9, 1.1],
      },
      {
        id: "c2",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [-1.9, 0.3],
      },
      {
        id: "hdr1",
        name: "Header 5-pin",
        kind: "hdr",
        smd: false,
        p: [1.9, -1.9],
        n: 5,
      },
    ],
    faultRule: {
      id: "contact-debris",
      label: "Encoder contact fault",
      cause:
        "Contact debris on the quadrature ring shorts phase A to phase B.",
      effect: "Counts double; every detent lands on a half step.",
      errorMessage: "Quadrature fault — phase A shorted to phase B.",
      criticalPart: "enc1",
      criticalParts: ["c1"],
    },
  },
  {
    id: 11,
    name: "PCA9685 servo board",
    subtitle: "16 PWM over I2C",
    description: [
      { text: "The " },
      { text: "PCA9685", bold: true },
      { text: " drives " },
      { text: "16 PWM channels", bold: true },
      { text: " over I2C from a single " },
      { text: "25 MHz", bold: true },
      {
        text: " oscillator — the go-to board for commanding a small servo army.",
      },
    ],
    code: `// PCA9685: 16 PWM channels over I2C
#include <Wire.h>
#define PCA9685 0x40

void writeReg(byte reg, byte val) {
  Wire.beginTransmission(PCA9685);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

void setup() {
  Wire.begin();
  writeReg(0x00, 0x20); // autoincrement on
  writeReg(0xFE, 0x79); // ~50 Hz frame
  Serial.begin(9600);
}

void loop() {
  for (byte ch = 0; ch < 16; ch++) {
    writeReg(0x06 + ch * 4, 0);
    writeReg(0x07 + ch * 4, 2048);
  }
  Serial.println("all 16 channels at 50%");
  delay(1000);
}`,
    parts: [
      {
        id: "pca",
        name: "PCA9685 PWM chip",
        kind: "qfp",
        smd: true,
        p: [0.2, 0.4],
        label: "PCA9685",
      },
      {
        id: "e1",
        name: "100µF cap",
        kind: "ecap",
        smd: false,
        p: [1.9, 1.3],
      },
      {
        id: "x1",
        name: "25 MHz crystal",
        kind: "xtal",
        smd: false,
        p: [-1.5, -0.9],
        label: "25MHz",
      },
      {
        id: "r1",
        name: "I2C pull-up",
        kind: "res",
        smd: true,
        p: [-1.6, 1.0],
      },
      {
        id: "hdr1",
        name: "PWM header A",
        kind: "hdr",
        smd: false,
        p: [-1.2, 1.9],
        n: 8,
      },
      {
        id: "hdr2",
        name: "PWM header B",
        kind: "hdr",
        smd: false,
        p: [-1.2, -1.9],
        n: 8,
      },
      {
        id: "led2",
        name: "Error LED",
        kind: "led",
        smd: true,
        p: [2.3, -0.8],
        color: "#ffb020",
      },
    ],
    faultRule: {
      id: "osc-dead",
      label: "Dead oscillator",
      cause:
        "The 25 MHz crystal never starts because its load caps were left off the board.",
      effect: "All 16 PWM outputs freeze at duty 0.",
      errorMessage: "PCA9685 oscillator fault — 16 PWM outputs frozen.",
      criticalPart: "pca",
      criticalParts: ["x1"],
    },
  },
  {
    id: 12,
    name: "I2C OLED display",
    subtitle: "128x64 pixels",
    description: [
      { text: "The " },
      { text: "SSD1306 OLED", bold: true },
      { text: " renders " },
      { text: "128 × 64", bold: true },
      {
        text: " pixels over I2C with no backlight — pure emissive glass: crisp text at any angle and near-zero power when dark.",
      },
    ],
    code: `// SSD1306: hello over I2C at 0x3C
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 oled(128, 64, &Wire, -1);

void setup() {
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  Serial.begin(9600);
}

void loop() {
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.println("ROBOTICS BENCH");
  oled.setCursor(0, 16);
  oled.println("hello, 128x64");
  oled.display();
  Serial.println("frame drawn");
  delay(500);
}`,
    parts: [
      {
        id: "oled1",
        name: "SSD1306 128x64",
        kind: "oled",
        smd: false,
        p: [0, 0.4],
        label: "OLED",
      },
      {
        id: "r1",
        name: "4.7kΩ pull-up SDA",
        kind: "res",
        smd: true,
        p: [1.7, 1.0],
      },
      {
        id: "r2",
        name: "4.7kΩ pull-up SCL",
        kind: "res",
        smd: true,
        p: [1.7, 0.2],
      },
      {
        id: "c1",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [-1.8, 1.1],
      },
      {
        id: "hdr1",
        name: "I2C header",
        kind: "hdr",
        smd: false,
        p: [-2.3, -1.9],
        n: 4,
      },
    ],
    faultRule: {
      id: "addr-conflict",
      label: "Address conflict",
      cause:
        "A second I2C device answers on the same 0x3C address and the controller wedges.",
      effect: "The glass stays dark; the bus reads all zeros.",
      errorMessage: "I2C address conflict — OLED stuck dark at 0x3C.",
      criticalPart: "oled1",
      criticalParts: ["r1"],
    },
  },
  {
    id: 13,
    name: "MPU-6050 IMU",
    subtitle: "sensor fusion",
    description: [
      { text: "Sensor fusion: a " },
      { text: "complementary filter", bold: true },
      { text: " blends the gyro's fast " },
      { text: "rate integration", bold: true },
      { text: " with the accelerometer's slow " },
      { text: "gravity reference", bold: true },
      {
        text: " into one stable angle. Calibrate the zero point regularly or the estimate drifts away.",
      },
    ],
    code: `// Complementary filter: 0.98 gyro + 0.02 accel
#include <Wire.h>
float angle = 0;
unsigned long last = 0;

void setup() {
  Wire.begin();
  Wire.beginTransmission(0x68);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);
  Serial.begin(115200);
  last = millis();
}

void loop() {
  float gyroZ = readGyroZ();      // deg/s
  float accelPitch = readAccel(); // deg
  unsigned long now = millis();
  float dt = (now - last) / 1000.0;
  last = now;
  angle = 0.98 * (angle + gyroZ * dt) + 0.02 * accelPitch;
  Serial.println("angle: " + String(angle, 1) + "°");
  delay(20);
}`,
    parts: [
      {
        id: "imu1",
        name: "MPU-6050",
        kind: "imu",
        smd: false,
        p: [-0.4, 0.4],
        label: "MPU-6050",
      },
      {
        id: "btn1",
        name: "CAL button",
        kind: "btn",
        smd: false,
        p: [1.9, 1.4],
        label: "CAL",
      },
      {
        id: "led2",
        name: "Status LED",
        kind: "led",
        smd: true,
        p: [2.3, -0.9],
        color: "#3dff6a",
      },
      {
        id: "c1",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [-2.0, 1.1],
      },
      {
        id: "hdr1",
        name: "Sensor header",
        kind: "hdr",
        smd: false,
        p: [-1.5, -2.0],
        n: 8,
      },
    ],
    faultRule: {
      id: "gyro-drift",
      label: "Gyro drift",
      cause:
        "The filter runs without periodic calibration and the gyro zero-rate offset creeps.",
      effect: "The estimated angle diverges from reality within a minute.",
      errorMessage:
        "Sensor fusion diverged — recalibrate the gyro zero point.",
      criticalPart: "imu1",
      criticalParts: ["btn1"],
    },
  },
];

export const BOARDS: [string, string][] = BOARD_SPECS.map((b) => [
  b.name,
  b.subtitle,
]);
