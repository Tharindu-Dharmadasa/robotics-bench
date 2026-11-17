// src/customLab/presetData.ts

import { PlacedCustomPart, CustomWire, CustomComponentType } from "./customTypes";

/** Helper to generate a unique id prefix for a preset */
const idPrefix = (name: string) => `${name.replace(/\s+/g, "_").toLowerCase()}`;

/** Safe LED + 220Ω Circuit (pre‑wired, works when powered) */
export const safeLedPreset = {
  parts: [
    {
      id: `${idPrefix("safe")}\_led`,
      type: "led_red" as CustomComponentType,
      name: "Red LED",
      gridCol: 5,
      gridRow: "top",
    },
    {
      id: `${idPrefix("safe")}\_res`,
      type: "res_220" as CustomComponentType,
      name: "220Ω Resistor",
      gridCol: 6,
      gridRow: "top",
    },
  ] as PlacedCustomPart[],
  wires: [
    // LED anode → Resistor terminal A
    {
      id: `${idPrefix("safe")}\_wire1`,
      fromPinId: `${idPrefix("safe")}\_led:anode`,
      toPinId: `${idPrefix("safe")}\_res:a`,
      color: "#ff0000",
    },
    // Resistor terminal B → 5V rail (via column 8 top)
    {
      id: `${idPrefix("safe")}\_wire2`,
      fromPinId: `${idPrefix("safe")}\_res:b`,
      toPinId: "col8_top",
      color: "#ff0000",
    },
    // LED cathode → GND rail (via column 9 bottom)
    {
      id: `${idPrefix("safe")}\_wire3`,
      fromPinId: `${idPrefix("safe")}\_led:cathode`,
      toPinId: "col9_bottom",
      color: "#ff0000",
    },
  ] as CustomWire[],
};

/** Overcurrent LED Burnout Demo (10Ω resistor, will burn out) */
export const burnoutDemoPreset = {
  parts: [
    {
      id: `${idPrefix("burnout")}\_led`,
      type: "led_green" as CustomComponentType,
      name: "Green LED",
      gridCol: 5,
      gridRow: "top",
    },
    {
      id: `${idPrefix("burnout")}\_res`,
      type: "res_10" as CustomComponentType,
      name: "10Ω Resistor",
      gridCol: 6,
      gridRow: "top",
    },
  ] as PlacedCustomPart[],
  wires: [
    {
      id: `${idPrefix("burnout")}\_wire1`,
      fromPinId: `${idPrefix("burnout")}\_led:anode`,
      toPinId: `${idPrefix("burnout")}\_res:a`,
      color: "#ff0000",
    },
    {
      id: `${idPrefix("burnout")}\_wire2`,
      fromPinId: `${idPrefix("burnout")}\_res:b`,
      toPinId: "col8_top",
      color: "#ff0000",
    },
    {
      id: `${idPrefix("burnout")}\_wire3`,
      fromPinId: `${idPrefix("burnout")}\_led:cathode`,
      toPinId: "col9_bottom",
      color: "#ff0000",
    },
  ] as CustomWire[],
};

/** SG90 Servo + I2C OLED Rig (multi‑module setup) */
export const servoOledPreset = {
  parts: [
    {
      id: `${idPrefix("rig")}\_servo`,
      type: "sg90_servo" as CustomComponentType,
      name: "SG90 Servo",
      gridCol: 10,
      gridRow: "top",
    },
    {
      id: `${idPrefix("rig")}\_oled`,
      type: "oled_i2c" as CustomComponentType,
      name: "I2C OLED",
      gridCol: 12,
      gridRow: "top",
    },
  ] as PlacedCustomPart[],
  wires: [
    // Servo VCC → 5V rail
    {
      id: `${idPrefix("rig")}\_wire1`,
      fromPinId: `${idPrefix("rig")}\_servo:VCC`,
      toPinId: "col8_top",
      color: "#ff0000",
    },
    // Servo GND → GND rail
    {
      id: `${idPrefix("rig")}\_wire2`,
      fromPinId: `${idPrefix("rig")}\_servo:GND`,
      toPinId: "col9_bottom",
      color: "#ff0000",
    },
    // Servo PWM → D9 pin
    {
      id: `${idPrefix("rig")}\_wire3`,
      fromPinId: `${idPrefix("rig")}\_servo:PWM`,
      toPinId: "uno_D9",
      color: "#ff0000",
    },
    // OLED VCC → 5V rail
    {
      id: `${idPrefix("rig")}\_wire4`,
      fromPinId: `${idPrefix("rig")}\_oled:VCC`,
      toPinId: "col8_top",
      color: "#ff0000",
    },
    // OLED GND → GND rail
    {
      id: `${idPrefix("rig")}\_wire5`,
      fromPinId: `${idPrefix("rig")}\_oled:GND`,
      toPinId: "col9_bottom",
      color: "#ff0000",
    },
    // OLED SDA → SDA pin
    {
      id: `${idPrefix("rig")}\_wire6`,
      fromPinId: `${idPrefix("rig")}\_oled:SDA`,
      toPinId: "uno_SDA",
      color: "#ff0000",
    },
    // OLED SCL → SCL pin
    {
      id: `${idPrefix("rig")}\_wire7`,
      fromPinId: `${idPrefix("rig")}\_oled:SCL`,
      toPinId: "uno_SCL",
      color: "#ff0000",
    },
  ] as CustomWire[],
};

/** Exported map for easy lookup by UI */
export const PRESET_MAP: Record<string, { parts: PlacedCustomPart[]; wires: CustomWire[]; label: string }> = {
  safe_led: { parts: safeLedPreset.parts, wires: safeLedPreset.wires, label: "Safe LED + 220Ω Circuit" },
  burnout: { parts: burnoutDemoPreset.parts, wires: burnoutDemoPreset.wires, label: "Overcurrent LED Burnout Demo" },
  servo_oled: { parts: servoOledPreset.parts, wires: servoOledPreset.wires, label: "SG90 Servo + I2C OLED Rig" },
};
