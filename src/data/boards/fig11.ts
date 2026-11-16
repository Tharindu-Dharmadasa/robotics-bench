import type { BoardSpec } from "../../types/simulator";

export const fig11: BoardSpec = {
    id: 11,
    name: "PCA9685 servo board",
    subtitle: "16 PWM over I2C",
    boardStyle: "pca9685-blue",
    description: [
      { text: "The " },
      { text: "PCA9685 16-channel 12-bit PWM controller", bold: true },
      {
        text: " drives an entire robotics servo array over an open-drain I2C bus at address ",
      },
      { text: "0x40", bold: true },
      { text: ". Driven by an onboard " },
      { text: "25 MHz reference oscillator", bold: true },
      {
        text: ", all 16 channels run free without consuming MCU timer interrupts. A massive ",
      },
      { text: "1000 µF low-ESR bulk capacitor", bold: true },
      {
        text: " buffers high-current servo stall surges on the V+ rail, while a dedicated ",
      },
      { text: "high-current screw terminal", bold: true },
      { text: " isolates motor power from sensitive logic." },
    ],
    code: `// PCA9685: 16-Channel 12-Bit PWM Driver (50Hz Servo Wave)
#include <Wire.h>
#define PCA9685_ADDR 0x40
#define MODE1 0x00
#define PRESCALE 0xFE
#define LED0_ON_L 0x06

void write8(byte reg, byte val) {
  Wire.beginTransmission(PCA9685_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

void setPWM(byte ch, uint16_t on, uint16_t off) {
  Wire.beginTransmission(PCA9685_ADDR);
  Wire.write(LED0_ON_L + 4 * ch);
  Wire.write(on & 0xFF);
  Wire.write(on >> 8);
  Wire.write(off & 0xFF);
  Wire.write(off >> 8);
  Wire.endTransmission();
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  write8(MODE1, 0x00);         // Wake up PCA9685
  write8(PRESCALE, 0x79);       // 25MHz osc -> 50 Hz PWM (~20ms period)
  write8(MODE1, 0xA1);         // Auto-increment enable
}

void loop() {
  for (uint16_t pulse = 205; pulse <= 410; pulse += 15) { // 1.0ms to 2.0ms
    for (byte ch = 0; ch < 16; ch++) {
      setPWM(ch, 0, pulse + ch * 4);
    }
    Serial.println("PCA9685: Sweeping 16 channels @ 50Hz (Pulse=" + String(pulse) + "/4096)");
    delay(100);
  }
}`,
    faultRule: {
      id: "pca9685-brownout",
      label: "Servo Rail Brownout & Clock Halt",
      cause:
        "1000µF bulk capacitor removed while 16 servos draw simultaneous stall current",
      effect:
        "Transient motor inrush collapses the V+ rail from 6.0V to <2.5V, crashing the I2C bus",
      errorMessage:
        "HALT: V+ rail collapse — 1000µF bulk capacitor missing; servo stall surge brownout!",
      criticalPart: "pca_ic",
      criticalParts: ["pca_ic", "c_bulk", "x_osc"],
    },
    parts: [
      {
        id: "pca_ic",
        name: "PCA9685 16-Channel PWM QFP",
        kind: "qfp",
        smd: true,
        p: [0, 0],
        label: "PCA9685",
        onRemoveEffect: {
          severity: "halt",
          message:
            "PWM CONTROLLER REMOVED: 16-channel 12-bit timer registers and I2C address decoder are missing.",
        },
      },
      {
        id: "x_osc",
        name: "25 MHz Reference Crystal",
        kind: "xtal",
        smd: false,
        p: [-1.4, 0.45],
        label: "25MHz",
        onRemoveEffect: {
          severity: "halt",
          message:
            "PWM TIMEBASE FROZEN: without the 25 MHz reference clock, internal counters stop; all 16 PWM channel outputs stay stuck at duty 0.",
        },
      },
      {
        id: "c_bulk",
        name: "1000µF 16V Bulk Reservoir Cap",
        kind: "ecap",
        smd: false,
        p: [-2.1, -0.55],
        value: "1000µF",
        valueOptions: ["1000µF", "100µF", "10µF"],
        onRemoveEffect: {
          severity: "halt",
          message:
            "SERVO BUS BROWNOUT: without the 1000 µF reservoir, simultaneous servo acceleration pulls massive di/dt transients that collapse the power rail and reset the MCU.",
        },
      },
      {
        id: "term_pwr",
        name: "V+ / GND Power Screw Terminal",
        kind: "screw",
        smd: false,
        p: [-2.5, 0.45],
        label: "V+ / GND",
        onRemoveEffect: {
          severity: "halt",
          message:
            "EXTERNAL SERVO SUPPLY DISCONNECTED: the high-current V+ power rail feeding the 16 servo connectors is severed.",
        },
      },
      {
        id: "hdr_i2c",
        name: "6-Pin I2C Cascade Header",
        kind: "hdr",
        smd: false,
        p: [-2.7, -0.05],
        n: 6,
        rot: Math.PI / 2,
        label: "I2C",
        onRemoveEffect: {
          severity: "halt",
          message:
            "HOST I2C LINK DISCONNECTED: VCC, GND, SDA, SCL, and Output Enable (OE) lines uncoupled from the microcontroller.",
        },
      },
      {
        id: "hdr_servos_lo",
        name: "Servo Headers CH0–CH7",
        kind: "hdr",
        smd: false,
        p: [0.85, 0.65],
        n: 8,
        label: "CH 0-7",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "SERVO CHANNELS 0–7 DISCONNECTED: outputs 0 through 7 lost signal, power, and ground pins.",
        },
      },
      {
        id: "hdr_servos_hi",
        name: "Servo Headers CH8–CH15",
        kind: "hdr",
        smd: false,
        p: [0.85, -0.65],
        n: 8,
        label: "CH 8-15",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "SERVO CHANNELS 8–15 DISCONNECTED: outputs 8 through 15 lost signal, power, and ground pins.",
        },
      },
      {
        id: "r_i2c",
        name: "4.7kΩ I2C Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [-0.9, -0.55],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "I2C BUS HUNG: open-drain SDA/SCL lines unable to reach logic HIGH without pull-ups.",
        },
      },
      {
        id: "led_pwr",
        name: "Power Indicator LED",
        kind: "led",
        smd: true,
        p: [2.5, 0.8],
        color: "#22c55e",
        label: "PWR",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "POWER LED REMOVED: visual indication of 5 V logic rail status is lost.",
        },
      },
    ],
  };
