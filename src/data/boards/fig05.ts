import type { BoardSpec } from "../../types/simulator";

export const fig05: BoardSpec = {
    id: 5,
    name: "Ultrasonic sensor",
    subtitle: "echo ranging",
    boardStyle: "hc-sr04",
    description: [
      { text: "The " },
      { text: "HC-SR04", bold: true },
      { text: " pings a " },
      { text: "40 kHz", bold: true },
      {
        text: " ultrasonic burst from its T transducer and times the echo on R: distance = speed of sound × time ÷ 2. Under the twin silver cans sit a MAX232-style driver, an LM324 gain stage and a 4 MHz crystal.",
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
        id: "tx1",
        name: "T transducer (16mm)",
        kind: "transducer",
        smd: false,
        p: [1.7, 0.85],
        label: "T · emit",
        onRemoveEffect: {
          severity: "halt",
          message:
            "NO PING, NO ECHO: the T can converts the 40 kHz burst from the MAX232-style driver into an ultrasonic pulse. With the emitter gone the board shouts into silence — pulseIn waits a full 25 ms on every cycle and always times out.",
        },
      },
      {
        id: "rx1",
        name: "R transducer (16mm)",
        kind: "transducer",
        smd: false,
        p: [1.7, -0.85],
        label: "R · receive",
        onRemoveEffect: {
          severity: "halt",
          message:
            "DEAF SENSOR: the R can is the microphone. The burst still leaves the board, but the reflected wave has nothing to land on — the LM324 amp sees a flat line and the echo pin never rises.",
        },
      },
      {
        id: "u1",
        name: "MAX232 driver",
        kind: "dip",
        smd: false,
        p: [-0.9, 0.5],
        n: 16,
        label: "U1 · TX drive",
        onRemoveEffect: {
          severity: "halt",
          message:
            "TRANSMIT STAGE GONE: the RS-232-level driver IC swings the ~10 V push-pull burst that actually rings the T transducer at 40 kHz. Without it, TRIG goes into a dead transmitter — receive side healthy, nothing ever sent.",
        },
      },
      {
        id: "u2",
        name: "LM324 gain stage",
        kind: "dip",
        smd: false,
        p: [-0.9, -0.55],
        n: 14,
        label: "U2 · RX amp",
        onRemoveEffect: {
          severity: "halt",
          message:
            "RECEIVE AMP GONE: a returning echo across 3 m arrives at a few millivolts — barely a whisper. The LM324's op-amps amplify it ~60× into a logic edge; without that gain the comparator never fires and ECHO stays low.",
        },
      },
      {
        id: "y1",
        name: "4.00MHz crystal",
        kind: "xtal",
        smd: false,
        p: [0.55, 0.05],
        value: "4.00MHz",
        label: "Y1",
        onRemoveEffect: {
          severity: "halt",
          message:
            "CLOCK COLLAPSED: the 4 MHz crystal is the timebase that synthesises the 40 kHz carrier and runs the control logic on the board's small MCU. Remove it and the oscillator stalls — TRIG pulses go unanswered.",
        },
      },
      {
        id: "h1",
        name: "4-pin right-angle header",
        kind: "hdr",
        smd: false,
        p: [-1.95, 0],
        n: 4,
        rot: Math.PI / 2,
        label: "VCC TRIG ECHO GND",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "MODULE ISOLATED: VCC, TRIG, ECHO and GND all enter through these four right-angle pins. Lift it and the sensor is electrically an island — fully intact, but with no way for the MCU to ask it anything.",
        },
      },
      {
        id: "r1",
        name: "10kΩ pull-up",
        kind: "res",
        smd: true,
        p: [0.6, -0.9],
        value: "10kΩ",
        label: "R1",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "FLOATING ECHO LINE: the echo pin is push-pull only while the module is ranging. Between pings the 10 kΩ pull-up defines it — without R1 the line drifts and pulseIn reads phantom edges from mains hum.",
        },
      },
      {
        id: "c1",
        name: "100nF decoupling cap",
        kind: "cap",
        smd: true,
        p: [-1.95, -0.8],
        value: "100nF",
        label: "C1",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "BURST GLITCHES: the transmit stage dumps a hard 10 V swing every ping. C1 shunts that transient at the source; without it the supply line rings and the sensitive receive amps mis-trigger on the noise.",
        },
      },
    ],
    faultRule: {
      id: "echo-timeout",
      label: "Echo timeout",
      cause:
        "The T transducer is overdriven past its rated voltage and detunes.",
      effect: "The echo never returns; every ping times out at 25 ms.",
      errorMessage: "HC-SR04 echo timeout — no return pulse.",
      criticalPart: "tx1",
      criticalParts: ["c1"],
    },
  };
