import type { BoardSpec } from "../../types/simulator";

export const fig10: BoardSpec = {
    id: 10,
    name: "Rotary encoder",
    subtitle: "quadrature",
    boardStyle: "ky040-dark",
    description: [
      { text: "The " },
      { text: "KY-040 rotary encoder module", bold: true },
      { text: " uses an " },
      { text: "EC11 mechanical quadrature encoder", bold: true },
      {
        text: " to track rotational angle and direction with high precision. Two internal contact switches (CLK and DT) trigger with a ",
      },
      { text: "90° phase shift", bold: true },
      {
        text: ": reading DT on the falling edge of CLK reveals whether rotation is clockwise or counter-clockwise. Dual ",
      },
      { text: "10 kΩ pull-up resistors", bold: true },
      { text: " hold lines high at idle, while " },
      { text: "100 nF RC filter capacitors", bold: true },
      {
        text: " eliminate contact chatter. An integrated push switch triggers when the D-shaft is pressed.",
      },
    ],
    code: `// KY-040 EC11 Rotary Encoder: Quadrature Decoding
const int PIN_CLK = 2; // Interrupt A
const int PIN_DT  = 3; // Direction B
const int PIN_SW  = 4; // Push switch
volatile long encoderPos = 0;
volatile bool rotated = false;

void isrClk() {
  int dtVal = digitalRead(PIN_DT);
  if (dtVal == HIGH) encoderPos++;
  else encoderPos--;
  rotated = true;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_CLK, INPUT_PULLUP);
  pinMode(PIN_DT,  INPUT_PULLUP);
  pinMode(PIN_SW,  INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_CLK), isrClk, FALLING);
}

void loop() {
  if (rotated) {
    rotated = false;
    Serial.println("ENCODER: " + String(encoderPos) + " counts (Detent step)");
  }
  if (digitalRead(PIN_SW) == LOW) {
    Serial.println("ENCODER [SW]: Shaft Button Pressed! Zeroing count...");
    encoderPos = 0;
    delay(200);
  }
  delay(10);
}`,
    faultRule: {
      id: "ky040-bounce",
      label: "Contact Chatter & Phase Ambiguity",
      cause: "100nF debounce capacitors removed from CLK/DT lines",
      effect:
        "Mechanical spring contact bounce fires 5–15 false interrupts per detent",
      errorMessage:
        "DEGRADED: Contact chatter — debounce filter missing, encoder count jumping erratically!",
      criticalPart: "enc_sw",
      criticalParts: ["enc_sw", "c_clk", "r_clk"],
    },
    parts: [
      {
        id: "enc_sw",
        name: "EC11 Encoder + D-Shaft",
        kind: "encoder",
        smd: false,
        p: [0, -0.2],
        label: "EC11",
        onRemoveEffect: {
          severity: "halt",
          message:
            "ROTARY ENCODER DISMOUNTED: mechanical quadrature contacts and rotating shaft switch are missing.",
        },
      },
      {
        id: "r_clk",
        name: "10kΩ CLK Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [-0.7, 0.65],
        value: "10kΩ",
        valueOptions: ["10kΩ", "1kΩ", "100kΩ"],
        onRemoveEffect: {
          severity: "halt",
          message:
            "CLK LINE FLOATING: without the 10 kΩ pull-up, Channel A floats in high impedance and fails to generate falling edge interrupts.",
        },
      },
      {
        id: "r_dt",
        name: "10kΩ DT Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [-0.25, 0.65],
        value: "10kΩ",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "DT DIRECTION AMBIGUOUS: without the Channel B pull-up, the MCU cannot reliably sample rotation direction; steps register randomly.",
        },
      },
      {
        id: "c_clk",
        name: "100nF CLK Debounce Cap",
        kind: "cap",
        smd: true,
        p: [0.25, 0.65],
        value: "100nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "CLK CONTACT CHATTER: mechanical switch bounce triggers multiple spurious interrupt bursts on every physical detent.",
        },
      },
      {
        id: "c_dt",
        name: "100nF DT Debounce Cap",
        kind: "cap",
        smd: true,
        p: [0.7, 0.65],
        value: "100nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "DT NOISE GLITCHES: contact bounce creates phase jitter during quadrature evaluation.",
        },
      },
      {
        id: "sw_push",
        name: "Tactile Push Switch",
        kind: "btn",
        smd: false,
        p: [0, 0.25],
        label: "SW",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "PUSH SWITCH DISABLED: axial push-to-click functionality is disconnected.",
        },
      },
      {
        id: "hdr_5p",
        name: "5-Pin Interface Header",
        kind: "hdr",
        smd: false,
        p: [0, 1.25],
        n: 5,
        label: "KY-040",
        onRemoveEffect: {
          severity: "halt",
          message:
            "INTERFACE CONNECTOR UNPLUGGED: CLK, DT, SW, VCC, and GND are severed from host MCU.",
        },
      },
    ],
  };
