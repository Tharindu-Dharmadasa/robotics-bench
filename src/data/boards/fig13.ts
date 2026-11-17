import type { BoardSpec } from "../../types/simulator";

export const fig13: BoardSpec = {
    id: 13,
    name: "MPU-6050 Sensor Fusion",
    subtitle: "sensor fusion",
    boardStyle: "fusion-purple",
    description: [
      { text: "Sensor Fusion: a " },
      { text: "Complementary Filter", bold: true },
      { text: " mathematically blends the gyroscope's instantaneous " },
      { text: "angular rate integration", bold: true },
      { text: " with the accelerometer's long-term " },
      { text: "gravity vector reference", bold: true },
      {
        text: " into one drift-free orientation angle. Gyroscopes respond in microseconds without lag but suffer from slow thermal bias drift, while accelerometers provide absolute tilt but jitter under vibration. Blending both (98% gyro + 2% accel) yields smooth attitude estimation. An onboard ",
      },
      { text: "CAL push button", bold: true },
      { text: " samples stationary noise to null zero-rate bias." },
    ],
    code: `// Sensor Fusion: Complementary Filter (Gyro + Accel)
#include <Wire.h>
#define MPU_ADDR 0x68
const int PIN_CAL = 4;
float pitch = 0.0, roll = 0.0;
float gyroBiasZ = 0.0;
unsigned long lastTime = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(PIN_CAL, INPUT_PULLUP);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // Wake up MPU-6050
  Wire.endTransmission(true);
  lastTime = millis();
}

void loop() {
  unsigned long now = millis();
  float dt = (now - lastTime) / 1000.0;
  lastTime = now;

  float gyroRate = 12.5; // deg/s from gyro
  float accelAngle = 14.2; // deg from gravity vector

  // Complementary filter: 98% gyro rate integration + 2% gravity reference
  pitch = 0.98 * (pitch + gyroRate * dt) + 0.02 * accelAngle;

  if (digitalRead(PIN_CAL) == LOW) {
    gyroBiasZ = 0.0;
    Serial.println("FUSION: Zero-bias calibration complete — null point locked.");
    delay(200);
  }

  Serial.println("FUSION [dt=" + String(dt * 1000, 0) + "ms]: Pitch=" + String(pitch, 1) + "° | AccelRef=" + String(accelAngle, 1) + "°");
  delay(100);
}`,
    faultRule: {
      id: "fusion-divergence",
      label: "Gyro Bias Runaway & Filter Divergence",
      cause:
        "Calibration circuit failed — zero-rate bias offset accumulates without reference nulling",
      effect:
        "Complementary filter angle estimate drifts by >45° within seconds of runtime",
      errorMessage:
        "BURNOUT: Gyro bias runaway — sensor fusion filter diverged into saturation!",
      criticalPart: "mpu_ic",
      criticalParts: ["mpu_ic", "btn_cal", "r_sda", "r_aux_pull", "ldo_fusion"],
    },
    parts: [
      {
        id: "mpu_ic",
        name: "MPU-6050 6-DOF MEMS Chip",
        kind: "imu",
        smd: true,
        p: [0.15, -0.05],
        label: "MPU-6050",
        onRemoveEffect: {
          severity: "halt",
          message:
            "MEMS SENSOR MISSING: no inertial sensor available to supply accelerometer or angular rate inputs.",
        },
      },
      {
        id: "mag_ic",
        name: "HMC5883L 3-Axis Magnetometer",
        kind: "imu",
        smd: true,
        p: [1.15, 0],
        label: "L883",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "MAGNETIC LOCK LOST: without the HMC5883L the complementary filter has no absolute heading reference — the fused yaw drifts +1.8°/s on uncalibrated gyro bias (amber warning).",
        },
      },
      {
        id: "btn_cal",
        name: "Zero-Rate CAL Button",
        kind: "btn",
        smd: false,
        p: [0.75, 0.4],
        label: "CAL",
        onRemoveEffect: {
          severity: "burnout",
          damagedPartId: "mpu_ic",
          message:
            "CALIBRATION REFERENCE LOST: without the CAL button to trigger zero-rate bias nulling, integrated gyro drift saturates attitude estimation.",
        },
      },
      {
        id: "ldo_fusion",
        name: "3.3V Low-Dropout Regulator",
        kind: "reg",
        smd: true,
        p: [-0.65, 0.4],
        value: "3.3V",
        onRemoveEffect: {
          severity: "halt",
          message:
            "3.3V SENSOR RAIL SHUTDOWN: internal MEMS sensing combs and analog front-end ADCs lose supply bias.",
        },
      },
      {
        id: "r_sda",
        name: "4.7kΩ SDA Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [-0.2, 0.4],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "I2C SDA OPEN: data line pulled to 0 V; host MCU receives no sensor data packets.",
        },
      },
      {
        id: "r_scl",
        name: "4.7kΩ SCL Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [0.25, 0.4],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "I2C SCL OPEN: clock line cannot toggle; I2C state machine hangs.",
        },
      },
      {
        id: "r_aux_pull",
        name: "4.7kΩ AUX I2C Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [0.85, -0.35],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "AUX I2C OPEN: the XDA/XCL pull-up floats the magnetometer bus — sensor fusion halts and every activity indicator freezes.",
        },
      },
      {
        id: "c_vreg",
        name: "100nF VREG Filter Cap",
        kind: "cap",
        smd: true,
        p: [-0.65, -0.5],
        value: "100nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "3.3V RAIL NOISE: high-frequency ripple degrades accelerometer ADC effective resolution.",
        },
      },
      {
        id: "c_cp",
        name: "10nF Charge Pump Cap",
        kind: "cap",
        smd: true,
        p: [0.65, -0.5],
        value: "10nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "MEMS DRIVE COLLAPSE: internal capacitive sensing charge pump loses amplitude; gyro sensitivity drops.",
        },
      },
      {
        id: "led_lock",
        name: "Fusion Lock Status LED",
        kind: "led",
        smd: true,
        p: [-0.75, -0.15],
        color: "#22c55e",
        label: "LOCK",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "STATUS LED REMOVED: visual filter convergence / lock indicator disabled.",
        },
      },
      {
        id: "hdr_8p",
        name: "8-Pin Breakout Header",
        kind: "hdr",
        smd: false,
        p: [0, 0.65],
        n: 8,
        label: "GY-521",
        onRemoveEffect: {
          severity: "halt",
          message:
            "BREAKOUT BUS SEVERED: all 8 power and communication pins isolated from host MCU.",
        },
      },
    ],
  };
