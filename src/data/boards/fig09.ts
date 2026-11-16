import type { BoardSpec } from "../../types/simulator";

export const fig09: BoardSpec = {
    id: 8,
    name: "MPU-6050 IMU",
    subtitle: "accel + gyro",
    boardStyle: "breakout-blue",
    description: [
      { text: "The " },
      { text: "GY-521 (MPU-6050)", bold: true },
      {
        text: " combines a 3-axis MEMS gyroscope and 3-axis accelerometer on a single silicon die. An onboard ",
      },
      { text: "3.3 V LDO regulator", bold: true },
      { text: " steps down 5 V input, while " },
      { text: "4.7 kΩ pull-up resistors", bold: true },
      { text: " keep the open-drain " },
      { text: "I2C (SDA/SCL)", bold: true },
      { text: " bus idle high at address " },
      { text: "0x68", bold: true },
      { text: "." },
    ],
    code: `// MPU-6050 6-Axis Accel + Gyro over I2C (0x68)
#include <Wire.h>
void setup() {
Serial.begin(9600);
Wire.begin();
Wire.beginTransmission(0x68);
Wire.write(0x6B); // PWR_MGMT_1
Wire.write(0);    // Wake up MPU-6050
Wire.endTransmission(true);
}
void loop() {
Serial.println("IMU 0x68 | Accel: [0.02, -0.01, 1.00g] | Gyro: [0.4, -0.2, 0.1 deg/s]");
delay(500);
}`,
    faultRule: {
      id: "mpu-i2c",
      label: "I2C Bus Pull-Up Missing",
      cause: "4.7kΩ SDA/SCL pull-up resistors removed",
      effect:
        "Open-drain I2C lines cannot return HIGH — master receives NACK at 0x68",
      errorMessage:
        "HALT: I2C NACK (0x68) — SDA/SCL pull-up resistors missing, bus stuck LOW!",
      criticalPart: "mpu_ic",
      criticalParts: ["mpu_ic", "ldo_3v3", "r_sda", "r_scl"],
    },
    parts: [
      {
        id: "mpu_ic",
        name: "MPU-6050 6-Axis MEMS QFN",
        kind: "imu",
        smd: true,
        p: [0.15, -0.05],
        label: "MPU-6050",
        onRemoveEffect: {
          severity: "halt",
          message:
            "MEMS SENSOR MISSING: no accelerometer or gyroscope silicon on board — I2C address 0x68 does not acknowledge.",
        },
      },
      {
        id: "ldo_3v3",
        name: "662K 3.3V LDO Regulator",
        kind: "reg",
        smd: true,
        p: [-0.65, 0.45],
        value: "3.3V",
        onRemoveEffect: {
          severity: "halt",
          message:
            "3.3V CORE RAIL DEAD: the MPU-6050 is strictly a 3.3 V chip; without the 662K LDO stepping down VCC, VDD and VDDIO sit at 0 V.",
        },
      },
      {
        id: "r_sda",
        name: "4.7kΩ SDA Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [-0.25, 0.55],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "SDA STUCK LOW: I2C uses open-drain drivers that can only pull lines to GND. Without the 4.7 kΩ pull-up to 3.3 V, SDA never rises and every read returns 0x00.",
        },
      },
      {
        id: "r_scl",
        name: "4.7kΩ SCL Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [0.05, 0.55],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "SCL CLOCK DEAD: without the 4.7 kΩ pull-up on SCL, the master cannot generate rising clock edges — I2C bus locks up immediately.",
        },
      },
      {
        id: "c_cpump",
        name: "2.2nF Charge-Pump Cap (CPOUT)",
        kind: "cap",
        smd: true,
        p: [0.65, 0.35],
        value: "2.2nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "GYRO DRIVE SATURATED: the MPU-6050 uses an internal charge pump with a 2.2 nF cap on pin 20 to excite the MEMS tuning-fork proof masses. Without it, gyro readings peg at ±2000 °/s.",
        },
      },
      {
        id: "c_vdd",
        name: "100nF VDD Bypass Cap",
        kind: "cap",
        smd: true,
        p: [0.65, -0.35],
        value: "100nF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "MEMS NOISE FLOOR ELEVATED: power supply ripple modulates the capacitive sense plates, adding ±0.15 g accelerometer jitter.",
        },
      },
      {
        id: "led_imu",
        name: "Power Indicator LED",
        kind: "led",
        smd: true,
        p: [-0.75, -0.45],
        color: "#3dff6a",
        label: "PWR",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "PWR LED OFF: sensor still streams over I2C, but visual 3.3 V power confirmation is gone.",
        },
      },
      {
        id: "hdr_gy521",
        name: "8-Pin Breakout Header",
        kind: "hdr",
        smd: false,
        p: [0, -0.82],
        n: 8,
        label: "VCC..INT",
        onRemoveEffect: {
          severity: "halt",
          message:
            "BREAKOUT PINS MISSING: VCC, GND, SDA, and SCL are disconnected from the host MCU.",
        },
      },
    ],
  };
