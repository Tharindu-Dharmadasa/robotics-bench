import type { BoardSpec } from "../../types/simulator";

export const fig06: BoardSpec = {
    id: 5,
    name: "L298N driver",
    subtitle: "H-bridge, why not",
    boardStyle: "l298n-red",
    description: [
      { text: "The " },
      { text: "L298N", bold: true },
      {
        text: " is a classic dual full H-bridge driver capable of driving two DC motors or one bipolar stepper at up to ",
      },
      { text: "2 A per channel", bold: true },
      {
        text: ". Four switching transistors form an 'H' around each motor coil so reversing diagonal pairs flips current direction, while ",
      },
      { text: "8 Schottky/1N4007 flyback diodes", bold: true },
      {
        text: " clamp inductive back-EMF spikes safely back to the supply rail.",
      },
    ],
    code: `// Dual H-Bridge DC Motor Control (Channel A)
const int ENA = 9;  // PWM speed
const int IN1 = 8;  // Direction 1
const int IN2 = 7;  // Direction 2

void setup() {
  Serial.begin(9600);
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
}

void loop() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, 200);
  Serial.println("MOTOR A: FWD @ 78% PWM (12.0V)");
  delay(1500);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  Serial.println("MOTOR A: REV @ 78% PWM (12.0V)");
  delay(1500);
}`,
    faultRule: {
      id: "l298n-flyback",
      label: "Inductive Back-EMF Spike",
      cause: "Flyback clamp diodes removed during motor commutation",
      effect: "24V inductive kickback arcs across L298N output transistors",
      errorMessage:
        "BURNOUT: Flyback diodes missing — motor back-EMF destroyed the L298N H-bridge!",
      criticalPart: "l298n_ic",
      criticalParts: ["l298n_ic", "diodes_flyback", "j5v"],
    },
    parts: [
      {
        id: "l298n_ic",
        name: "L298N IC + 7-Fin Heatsink",
        kind: "motorDriver",
        smd: false,
        p: [0, -1.35],
        label: "L298N",
        onRemoveEffect: {
          severity: "halt",
          message:
            "H-BRIDGE REMOVED: no power switches remain to commutate motor coils.",
        },
      },
      {
        id: "diodes_left",
        name: "4x 1N4007 Flyback Diodes (Ch A)",
        kind: "diode",
        smd: false,
        p: [-0.9, -0.15],
        label: "D1–D4",
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "l298n_ic",
          message:
            "BACK-EMF OVERVOLTAGE: inductive kickback from Motor A punctured the L298N H-bridge!",
        },
      },
      {
        id: "diodes_right",
        name: "4x 1N4007 Flyback Diodes (Ch B)",
        kind: "diode",
        smd: false,
        p: [0.9, -0.15],
        label: "D5–D8",
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "l298n_ic",
          message:
            "BACK-EMF OVERVOLTAGE: inductive kickback from Motor B destroyed the L298N driver!",
        },
      },
      {
        id: "reg78m05",
        name: "78M05 5V Regulator",
        kind: "reg",
        smd: true,
        p: [-1.05, 0.55],
        value: "78M05",
        onRemoveEffect: {
          severity: "halt",
          message:
            "5V LOGIC RAIL DEAD: without the 78M05 regulator, L298N internal logic gates shut off.",
        },
      },
      {
        id: "j5v",
        name: "5V-EN Regulator Jumper",
        kind: "jumper",
        smd: false,
        p: [-0.55, 0.55],
        label: "5V-EN",
        onRemoveEffect: {
          severity: "halt",
          message:
            "5V REGULATOR ISOLATED: pulling 5V-EN disconnects the 78M05 from the 12V supply.",
        },
      },
      {
        id: "ecap_vs",
        name: "220µF 35V Supply Cap",
        kind: "ecap",
        smd: false,
        p: [-1.38, 1.18],
        value: "220µF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "MOTOR RAIL RIPPLE: motor startup surges dip the 12V bus and reset the host MCU.",
        },
      },
      {
        id: "ecap_5v",
        name: "220µF 16V Logic Cap",
        kind: "ecap",
        smd: false,
        p: [0.34, 1.18],
        value: "220µF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "NOISY 5V LOGIC RAIL: PWM switching noise causes erratic direction glitches.",
        },
      },
      {
        id: "led_pwr",
        name: "5V Power LED",
        kind: "led",
        smd: true,
        p: [0.4, 0.65],
        color: "#ff3b30",
        label: "PWR",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "PWR LED OFF: 5V rail is still alive, but visual power confirmation is gone.",
        },
      },
      {
        id: "term_pwr",
        name: "12V / GND / 5V Terminal",
        kind: "screw",
        smd: false,
        p: [0, 1.88],
        n: 3,
        label: "12V/GND/5V",
        onRemoveEffect: {
          severity: "halt",
          message:
            "MAIN POWER DISCONNECTED: motor supply (VS) and ground reference are severed.",
        },
      },
      {
        id: "term_outa",
        name: "OUT1 / OUT2 Motor A Block",
        kind: "screw",
        smd: false,
        p: [-1.92, 0.05],
        n: 2,
        rot: Math.PI / 2,
        label: "OUT A",
        onRemoveEffect: {
          severity: "halt",
          message: "MOTOR A OPEN CIRCUIT: H-bridge output A is disconnected.",
        },
      },
      {
        id: "term_outb",
        name: "OUT3 / OUT4 Motor B Block",
        kind: "screw",
        smd: false,
        p: [1.92, 0.05],
        n: 2,
        rot: Math.PI / 2,
        label: "OUT B",
        onRemoveEffect: {
          severity: "degraded",
          message: "MOTOR B DISCONNECTED: Channel B is open.",
        },
      },
      {
        id: "hdr_ctrl",
        name: "ENA / IN1-IN4 / ENB Header",
        kind: "hdr",
        smd: false,
        p: [1.15, 1.62],
        n: 6,
        label: "LOGIC IN",
        onRemoveEffect: {
          severity: "halt",
          message:
            "CONTROL SIGNALS LOST: PWM and direction inputs are floating.",
        },
      },
    ],
  };
