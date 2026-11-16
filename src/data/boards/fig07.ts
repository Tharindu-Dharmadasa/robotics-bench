import type { BoardSpec } from "../../types/simulator";

export const fig07: BoardSpec = {
    id: 6,
    name: "A4988 stepper driver",
    subtitle: "microstepping",
    boardStyle: "stepstick",
    description: [
      { text: "The " },
      { text: "A4988 StepStick", bold: true },
      {
        text: " is a constant-current bipolar stepper driver with built-in translator logic. Each rising edge on ",
      },
      { text: "STEP", bold: true },
      { text: " advances the rotor by one full or microstep (down to " },
      { text: "1/16 step", bold: true },
      { text: "), while dual " },
      { text: "0.1 Ω current-sense resistors", bold: true },
      { text: " and the " },
      { text: "VREF trimpot", bold: true },
      { text: " regulate peak coil current via PWM chopping." },
    ],
    code: `// A4988 Microstepping Control (1/16 Step)
const int STEP_PIN = 3;
const int DIR_PIN  = 4;

void setup() {
  Serial.begin(9600);
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  digitalWrite(DIR_PIN, HIGH);
}

void loop() {
  for (int i = 0; i < 200; i++) {
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(800);
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(800);
  }
  Serial.println("STEPPER: +1 Rev (3200 uSteps @ I_max=1.2A)");
  delay(400);
}`,
    faultRule: {
      id: "a4988-sense",
      label: "Chopper Current Sense Failure",
      cause: "0.1Ω sense resistor removed or VREF set past thermal limit",
      effect:
        "Unregulated coil current overheats and destroys A4988 DMOS bridge",
      errorMessage:
        "BURNOUT: Current-sense feedback lost — stepper coil surge fried the A4988 driver!",
      criticalPart: "a4988_ic",
      criticalParts: ["a4988_ic", "rsense1", "rsense2"],
    },
    parts: [
      {
        id: "a4988_ic",
        name: "A4988 Driver + Heatsink",
        kind: "stepperDriver",
        smd: true,
        p: [0, -0.1],
        label: "A4988",
        onRemoveEffect: {
          severity: "halt",
          message:
            "DRIVER IC REMOVED: translator and dual DMOS full-bridges are gone; stepper motor has zero holding torque.",
        },
      },
      {
        id: "vref_pot",
        name: "VREF Current Trimpot",
        kind: "encoder",
        smd: true,
        p: [0.55, 0.55],
        value: "0.60V (1.2A Safe)",
        valueOptions: [
          "0.60V (1.2A Safe)",
          "1.45V (Overcurrent)",
          "0.00V (Zero Torque)",
        ],
        valueEffects: {
          "1.45V (Overcurrent)": {
            severity: "burnout",
            damagedPartId: "a4988_ic",
            message:
              "THERMAL RUNAWAY (I_trip = 2.9 A): VREF = 1.45 V exceeds the A4988 2 A peak rating — internal FETs hit >165°C and burn out.",
          },
          "0.00V (Zero Torque)": {
            severity: "degraded",
            message:
              "ZERO HOLDING TORQUE: VREF = 0 V sets chopper trip current to 0 A — STEP pulses tick cleanly, but the rotor stalls under any load.",
          },
        },
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "a4988_ic",
          message:
            "VREF FLOATING HIGH: removing the voltage-divider trimpot pulls REF toward VDD (5 V), commanding >6 A coil current and frying the A4988.",
        },
      },
      {
        id: "rsense1",
        name: "0.1Ω Sense Resistor A",
        kind: "res",
        smd: true,
        p: [-0.55, -0.45],
        value: "0.1Ω (R100)",
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "a4988_ic",
          message:
            "COIL A SENSE OPEN: without R100 to develop the V = I × R feedback voltage, the PWM chopper never turns off and Coil A FETs burn out.",
        },
      },
      {
        id: "rsense2",
        name: "0.1Ω Sense Resistor B",
        kind: "res",
        smd: true,
        p: [-0.55, 0.35],
        value: "0.1Ω (R100)",
        onRemoveEffect: {
          severity: "burnout",

          damagedPartId: "a4988_ic",
          message:
            "COIL B SENSE OPEN: Phase B chopper loses current feedback, causing runaway current and thermal destruction.",
        },
      },
      {
        id: "cap_vmot",
        name: "100µF VMOT Decoupling Cap",
        kind: "ecap",
        smd: false,
        p: [-0.85, 0.75],
        value: "100µF",
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "a4988_ic",
          message:
            "VMOT LC VOLTAGE SPIKE: Pololu warns that hot-plugging VMOT without a 100 µF electrolytic cap creates >40 V inductive ringing that destroys the A4988.",
        },
      },
      {
        id: "cap_vdd",
        name: "100nF Logic Bypass Cap",
        kind: "cap",
        smd: true,
        p: [0.55, -0.55],
        value: "100nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "STEP CLOCK GLITCHES: chopper switching noise couples into VDD, causing missed microsteps.",
        },
      },
      {
        id: "hdr_left",
        name: "8-Pin Logic Header (EN..DIR)",
        kind: "hdr",
        smd: false,
        p: [-0.95, 0],
        n: 8,
        rot: Math.PI / 2,
        onRemoveEffect: {
          severity: "halt",
          message:
            "LOGIC HEADER OPEN: STEP, DIR, and VDD pins are disconnected.",
        },
      },
      {
        id: "hdr_right",
        name: "8-Pin Motor Header (VMOT..GND)",
        kind: "hdr",
        smd: false,
        p: [0.95, 0],
        n: 8,
        rot: Math.PI / 2,
        onRemoveEffect: {
          severity: "halt",
          message:
            "MOTOR HEADER OPEN: VMOT and 1A/1B/2A/2B coil outputs are disconnected.",
        },
      },
    ],
  };
