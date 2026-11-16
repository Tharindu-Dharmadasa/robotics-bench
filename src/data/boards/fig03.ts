import type { BoardSpec } from "../../types/simulator";

export const fig03: BoardSpec = {
    id: 3,
    name: "Transistor switch",
    subtitle: "logic drives power",
    boardStyle: "perfboard",
    description: [
      { text: "Hand-soldered on " },
      { text: "perfboard", bold: true },
      { text: ": a " },
      { text: "2N2222A NPN", bold: true },
      { text: " switches a " },
      { text: "5 V relay", bold: true },
      {
        text: " coil, not the pin. A 1 kΩ base resistor limits the drive, a 10 kΩ pull-down keeps the base defined, and the 1N4007 flyback diode saves the transistor when the coil switches off.",
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
        name: "2N2222A NPN",
        kind: "to92",
        smd: false,
        p: [-0.9, 0.35],
        label: "Q1",
        onRemoveEffect: {
          severity: "halt",
          message:
            "NO CURRENT AMPLIFIER: a digital pin can only source ~20 mA — the relay coil alone wants 70 mA. Without Q1 the MCU pin is connected straight at the coil: it sags, browns out, and nothing ever switches. The transistor is the whole point of the lab.",
        },
      },
      {
        id: "rb",
        name: "1kΩ base resistor",
        kind: "res",
        smd: false,
        p: [0.45, 1.1],
        value: "1kΩ",
        label: "R-B · brown-black-red",
        valueOptions: ["1kΩ (Safe)", "10Ω (Too Low)", "100kΩ (Weak Drive)"],
        valueEffects: {
          "10Ω (Too Low)": {
            severity: "burnout",
            damagedPartId: "q1",
            message:
              "BASE OVERDRIVE: I_B = (5 V − 0.7 V) / 10 Ω ≈ 430 mA — thirty times the safe drive and far past the B-E junction's rating. The base-emitter junction avalanches and Q1 dies shorted.",
          },
          "100kΩ (Weak Drive)": {
            severity: "degraded",
            message:
              "STARVED BASE: I_B = (5 V − 0.7 V) / 100 kΩ ≈ 43 µA. With β≈100 the collector can only muster ~4 mA — the relay armature buzzes but never fully pulls in.",
          },
        },
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "q1",
          message:
            "UNLIMITED BASE CURRENT: with the 1 kΩ gone, the MCU pin clamps at V_BE ≈ 0.7 V and dumps its short-circuit current straight into the base-emitter junction — well past the pin's 40 mA absolute max. Q1's input junction cooks first.",
        },
      },
      {
        id: "rd",
        name: "10kΩ pull-down",
        kind: "res",
        smd: false,
        p: [0.45, 0.2],
        value: "10kΩ",
        label: "R-D · brown-black-orange",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "FLOATING BASE: with the pull-down gone, the base drifts toward its 0.7 V threshold whenever the MCU pin is Hi-Z (boot-up, reset). The transistor half-conducts on noise and the relay chatters randomly.",
        },
      },
      {
        id: "d1",
        name: "1N4007 flyback diode",
        kind: "diode",
        smd: false,
        p: [1.5, -0.55],
        label: "D1",
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "q1",
          message:
            "BACK-EMF KILLS Q1: the relay coil is a big inductor. Cut its current and the collapsing magnetic field drives V_CE to roughly −100 V (L·di/dt) — far past the 2N2222A's 40 V rating. The collector-emitter junction avalanches and dies, usually shorted.",
        },
      },
      {
        id: "k1",
        name: "5V relay",
        kind: "relay",
        smd: false,
        p: [1.9, 0.75],
        label: "K1 · SRD-5VDC",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "LOAD SWITCHING LOST: Q1 and the resistors now drive nothing. The 12 V loop through the screw terminal has no contactor — the switched load can never energise, even though every other part is healthy.",
        },
      },
      {
        id: "p1",
        name: "12V screw terminal",
        kind: "screw",
        smd: false,
        p: [-2.05, -1.25],
        label: "12V IN",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "LOAD SUPPLY SEVERED: the relay's switched contact now feeds an open terminal. The 5 V logic side still works and the relay clicks — but the 12 V load it was meant to power has no source.",
        },
      },
    ],
    faultRule: {
      id: "back-emf",
      label: "Back-EMF kill",
      cause:
        "The relay coil is de-energised with no 1N4007 flyback diode across it.",
      effect:
        "The collapsing magnetic field spikes the collector to about −100 V and avalanches the junction.",
      errorMessage:
        "Back-EMF avalanche — Q1 collector-emitter junction shorted.",
      criticalPart: "q1",
      criticalParts: ["d1"],
    },
  };
