import type { BoardSpec } from "../../types/simulator";

export const fig02: BoardSpec = {
    id: 2,
    name: "LED + resistor",
    subtitle: "Ohm's law",
    boardStyle: "breadboard",
    description: [
      { text: "The bench's simplest lab, built on a " },
      { text: "170-point solderless breadboard", bold: true },
      { text: ": a " },
      { text: "5 mm red LED", bold: true },
      { text: " fed from " },
      { text: "5 V", bold: true },
      { text: " through a " },
      { text: "220 Ω", bold: true },
      {
        text: " color-banded limiter (red-red-brown-gold). The resistor sets the branch to roughly 13 mA — swap it for 10 Ω and the LED burns out in a flash.",
      },
    ],
    code: `// LED blink through a 220Ω limiter
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
        id: "j1",
        name: "Jumper wire (5V)",
        kind: "jumper",
        smd: false,
        p: [-1.55, 0.85],
        color: "#d64b3a",
        rot: Math.PI / 2,
        label: "+5V",
        onRemoveEffect: {
          severity: "halt",
          message:
            "SUPPLY FEED CUT: this red jumper is the only path from the 5 V rail into the working row. With it gone the breadboard row is completely dead — no current can enter the LED branch at all, so nothing lights and nothing runs.",
        },
      },
      {
        id: "j2",
        name: "Jumper wire (GND)",
        kind: "jumper",
        smd: false,
        p: [-1.55, -0.85],
        color: "#22252a",
        rot: Math.PI / 2,
        label: "GND",
        onRemoveEffect: {
          severity: "halt",
          message:
            "RETURN PATH CUT: current needs a loop. Without this black jumper back to the ground rail, any current pushed into the row has nowhere to return — the LED branch reads open from the supply's point of view and stays dark.",
        },
      },
      {
        id: "j3",
        name: "Jumper wire (signal)",
        kind: "jumper",
        smd: false,
        p: [0.55, 0.9],
        color: "#e0b33a",
        label: "SIG",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "SIGNAL LINE SEVERED: the MCU pin no longer reaches the switch/LED branch. The supply and ground rails are intact, so the board looks healthy — but the control signal never arrives and the LED simply stays off.",
        },
      },
      {
        id: "r1",
        name: "220Ω resistor",
        kind: "res",
        smd: false,
        p: [-0.35, 0.35],
        value: "220Ω",
        label: "R1 · red-red-brown",
        valueOptions: ["220Ω (Safe)", "10Ω (Too Low)", "10kΩ (Dim)"],
        valueEffects: {
          "10Ω (Too Low)": {
            severity: "burnout",
            damagedPartId: "led2",
            message:
              "OVERCURRENT (300 mA): with a 10 Ω limiter the LED sees (5 V − 2 V) / 10 Ω ≈ 300 mA — fifteen times its 20 mA rating. The junction overheats and burns out within seconds.",
          },
          "10kΩ (Dim)": {
            severity: "degraded",
            message:
              "STARVED LED: (5 V − 2 V) / 10 kΩ ≈ 0.3 mA — a tenth of the design current. The LED still works electrically but glows so dim you'll think the circuit is off.",
          },
        },
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "led2",
          message:
            "NO CURRENT LIMIT: with the 220 Ω gone the LED is wired almost straight across 5 V. A red LED clamps its forward voltage at ~2 V, so the supply drives (5 − 2) V into nearly zero resistance — the junction flashes bright, cooks and dies.",
        },
      },
      {
        id: "led2",
        name: "5mm red LED",
        kind: "led",
        smd: false,
        p: [0.55, 0.35],
        color: "#ff4136",
        label: "LED",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "INDICATOR DARK: the series path is now open, so no current flows through the resistor either — nothing is damaged, you've simply removed the thing the circuit was built to light. Plug it back in and Blink resumes.",
        },
      },
      {
        id: "sw1",
        name: "Tactile switch",
        kind: "btn",
        smd: false,
        p: [0.95, -0.6],
        label: "SW1",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "MANUAL TRIGGER GONE: the tactile switch was the branch's input. Without it the MCU pin still drives the row through the signal jumper, but the push-button interaction the lab demonstrates is impossible.",
        },
      },
      {
        id: "c1",
        name: "100nF cap",
        kind: "cap",
        smd: true,
        p: [-0.35, -0.6],
        value: "100nF",
        label: "C1",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "RAIL SPIKES UNCAPPED: every time the LED branch switches, the sudden current step kicks the breadboard rails. C1 is the local charge reservoir that absorbs the spike — without it, sensitive neighbors on the rail see the glitch.",
        },
      },
    ],
    faultRule: {
      id: "led-burnout",
      label: "LED burnout",
      cause:
        "The LED is driven from 5 V with no current-limiting resistor in series.",
      effect:
        "The junction flashes bright, cooks and dies; the circuit reads open.",
      errorMessage: "Overcurrent on the LED leg — junction burned out.",
      criticalPart: "led2",
      criticalParts: ["r1"],
    },
  };
