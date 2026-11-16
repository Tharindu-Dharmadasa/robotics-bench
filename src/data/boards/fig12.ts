import type { BoardSpec } from "../../types/simulator";

export const fig12: BoardSpec = {
    id: 12,
    name: "I2C OLED display",
    subtitle: "128x64 pixels",
    boardStyle: "oled-module",
    description: [
      { text: "The " },
      { text: "SSD1306 0.96' OLED module", bold: true },
      { text: " integrates a crisp " },
      { text: "128 × 64 dot-matrix organic LED display", bold: true },
      { text: " driven via I2C at address " },
      { text: "0x3C", bold: true },
      {
        text: ". Because each organic pixel is self-emissive, the glass delivers pure deep blacks, infinite contrast, and wide 160° viewing angles. An integrated ",
      },
      { text: "charge-pump step-up converter", bold: true },
      {
        text: " boosts 3.3 V/5 V logic supply up to the ~7.5 V organic diode bias, stabilized by onboard ",
      },
      { text: "flying charge pump capacitors", bold: true },
      { text: " and " },
      { text: "4.7 kΩ I2C pull-ups", bold: true },
      { text: "." },
    ],
    code: `// SSD1306 128x64 I2C OLED Display Driver (0x3C)
#include <Wire.h>
#define OLED_ADDR 0x3C

void sendCmd(byte cmd) {
  Wire.beginTransmission(OLED_ADDR);
  Wire.write(0x00); // Command stream
  Wire.write(cmd);
  Wire.endTransmission();
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  sendCmd(0xAE); // Display OFF
  sendCmd(0xD5); sendCmd(0x80); // Set clock divide ratio
  sendCmd(0xA8); sendCmd(0x3F); // 64 multiplex
  sendCmd(0x8D); sendCmd(0x14); // Enable charge pump (7.5V bias)
  sendCmd(0x20); sendCmd(0x00); // Horizontal addressing mode
  sendCmd(0xAF); // Display ON
}

void loop() {
  static unsigned long frame = 0;
  frame++;
  Serial.println("OLED [0x3C]: 128x64 frame " + String(frame) + " rendered @ 30 FPS | VPP=7.5V");
  delay(500);
}`,
    faultRule: {
      id: "oled-chargepump",
      label: "Internal Charge Pump Bias Collapse",
      cause: "Flying charge-pump capacitor removed from SSD1306 bias booster",
      effect:
        "Booster circuit fails to generate 7.5V OLED drive voltage; glass stays completely dark",
      errorMessage:
        "HALT: OLED VCC collapse — charge pump capacitors missing; 7.5V bias rail dead!",
      criticalPart: "oled_glass",
      criticalParts: ["oled_glass", "c_pump", "r_sda"],
    },
    parts: [
      {
        id: "oled_glass",
        name: "SSD1306 0.96' OLED Glass + Flex",
        kind: "oled",
        smd: false,
        p: [0, 0.2],
        label: "SSD1306",
        onRemoveEffect: {
          severity: "halt",
          message:
            "OLED GLASS PANEL DISMOUNTED: no emissive pixel array or chip-on-glass driver connected.",
        },
      },
      {
        id: "c_pump",
        name: "1µF Charge Pump Flying Cap",
        kind: "cap",
        smd: true,
        p: [-0.9, -0.6],
        value: "1µF",
        valueOptions: ["1µF", "100nF", "10µF"],
        onRemoveEffect: {
          severity: "halt",
          message:
            "CHARGE PUMP DEAD: without the flying charge-pump capacitor, the SSD1306 cannot step up 3.3 V to the 7.5 V needed to illuminate organic pixels; screen stays dark.",
        },
      },
      {
        id: "c_vcc",
        name: "4.7µF VCC Filtering Cap",
        kind: "cap",
        smd: true,
        p: [0.9, -0.6],
        value: "4.7µF",
        onRemoveEffect: {
          severity: "degraded",
          message:
            "DISPLAY VOLTAGE RIPPLE: high internal ripple causes visible horizontal line flicker and pixel ghosting.",
        },
      },
      {
        id: "r_sda",
        name: "4.7kΩ SDA Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [-0.35, -0.6],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "I2C SDA HUNG LOW: serial data line fails to pull high; display controller times out and freezes.",
        },
      },
      {
        id: "r_scl",
        name: "4.7kΩ SCL Pull-Up Resistor",
        kind: "res",
        smd: true,
        p: [0.35, -0.6],
        value: "4.7kΩ",
        onRemoveEffect: {
          severity: "halt",
          message:
            "I2C SCL CLOCK LOST: serial clock line stays low; communication halts immediately.",
        },
      },
      {
        id: "hdr_i2c",
        name: "4-Pin Header (GND/VCC/SCL/SDA)",
        kind: "hdr",
        smd: false,
        p: [0, -1.15],
        n: 4,
        label: "I2C",
        onRemoveEffect: {
          severity: "halt",
          message:
            "INTERFACE CONNECTOR DETACHED: power supply and I2C control bus severed from host MCU.",
        },
      },
    ],
  };
