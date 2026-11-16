import type { BoardSpec, Part } from "../../types/simulator";

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
    valueOptions: [
      "500mA (Safe)",
      "100mA (Too Sensitive)",
      "Bypassed (No Protection)",
    ],
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

export const fig01: BoardSpec = {
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
  };
