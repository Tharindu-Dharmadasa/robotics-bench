import type { BoardSpec } from "../../types/simulator";

export const fig08: BoardSpec = {
    id: 7,
    name: "SG90 servo",
    subtitle: "PWM angle",
    boardStyle: "sg90-cutaway",
    description: [
      { text: "An " },
      { text: "SG90 micro servo", bold: true },
      {
        text: " is a closed-loop mechatronic actuator inside a compact gearbox. A ",
      },
      { text: "50 Hz PWM pulse (1.0–2.0 ms)", bold: true },
      { text: " sets the target angle (" },
      { text: "0°–180°", bold: true },
      {
        text: "), while an internal control IC compares that pulse against a ",
      },
      { text: "5 kΩ feedback potentiometer", bold: true },
      { text: " coupled to the output shaft." },
    ],
    code: `// SG90 Closed-Loop PWM Sweep (0° to 180°)
#include <Servo.h>
Servo sg90;
void setup() {
Serial.begin(9600);
sg90.attach(9); // 50Hz PWM (1000-2000us)
}
void loop() {
sg90.write(0);
Serial.println("SERVO PWM: 1000 us -> Angle: 0 deg");
delay(700);
sg90.write(90);
Serial.println("SERVO PWM: 1500 us -> Angle: 90 deg");
delay(700);
sg90.write(180);
Serial.println("SERVO PWM: 2000 us -> Angle: 180 deg");
delay(700);
}`,
    faultRule: {
      id: "sg90-pot",
      label: "Open-Loop Feedback Runaway",
      cause: "5kΩ position feedback potentiometer removed",
      effect:
        "Control IC never sees target angle reached and drives motor into hard stop",
      errorMessage:
        "BURNOUT: Feedback potentiometer missing — servo drove continuously into hard stop and stripped/stalled!",
      criticalPart: "servo_body",
      criticalParts: ["servo_body", "fb_pot", "ctrl_ic"],
    },
    parts: [
      {
        id: "servo_body",
        name: "SG90 Gearbox + DC Motor + Horn",
        kind: "servo",
        smd: false,
        p: [0, 0],
        label: "SG90",
        onRemoveEffect: {
          severity: "halt",
          message:
            "ACTUATOR REMOVED: DC motor, reduction gear train, and output spline are missing.",
        },
      },
      {
        id: "ctrl_ic",
        name: "KC5188 Servo Control IC",
        kind: "qfp",
        smd: true,
        p: [-0.25, 0.3],
        label: "KC5188",
        onRemoveEffect: {
          severity: "halt",
          message:
            "SERVO CONTROLLER DEAD: PWM pulse width comparator and internal H-bridge are missing.",
        },
      },
      {
        id: "fb_pot",
        name: "5kΩ Position Feedback Pot",
        kind: "encoder",
        smd: false,
        p: [0, 0],
        value: "5kΩ",
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "servo_body",
          message:
            "CLOSED-LOOP BROKEN: without the 5 kΩ wiper voltage telling the IC where the output horn is, the H-bridge stays locked at 100% duty cycle against the physical end-stop until the motor stalls and overheats.",
        },
      },
      {
        id: "cap_motor",
        name: "100nF Brush Noise Cap",
        kind: "cap",
        smd: true,
        p: [-0.3, -0.42],
        value: "100nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "COMMUTATOR EMI JITTER: DC motor brush arcing feeds noise back into the comparator, causing the servo horn to buzz and hunt around its setpoint.",
        },
      },
      {
        id: "hdr_pwm",
        name: "3-Pin Lead (GND / 5V / PWM)",
        kind: "hdr",
        smd: false,
        p: [-1.45, -0.35],
        n: 3,
        rot: Math.PI / 2,
        label: "PWM",
        onRemoveEffect: {
          severity: "halt",
          message:
            "3-WIRE LEAD UNPLUGGED: no 5 V power or 50 Hz PWM control signal reaches the servo.",
        },
      },
    ],
  };
