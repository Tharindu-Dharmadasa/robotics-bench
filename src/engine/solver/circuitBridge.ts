// ─────────────────────────────────────────────────────────────────────────────
// Bridge between the MNA solver and the board evaluation engine.
// Converts declarative part states and values into a CircuitNetlist, solves it,
// and returns SimulationResult compatible with the UI and CalcPanel.
// ─────────────────────────────────────────────────────────────────────────────

import { solveCircuit } from "./mnaSolver";
import type { CircuitNetlist } from "./types";
import type { SimulationResult } from "../../data/types";
import { LED_TYPES, formatOhms } from "../../data/parameters";

type ValueOf = (partId: string) => number | string;

export function analyzeSandboxBoard(value: ValueOf): Partial<SimulationResult> {
  const supplyV = Number(value("power") || 5);
  const ohms = Number(value("resistor") || 330);
  const ledKey = String(value("led") || "red");
  const led = LED_TYPES[ledKey] ?? LED_TYPES.red;
  const capUf = Number(value("filterCap") || 100);

  const netlist: CircuitNetlist = {
    groundNetId: "GND",
    nets: [
      { netId: "VCC", pins: ["V1.pinPos", "R1.pinA", "C1.pinA"] },
      { netId: "ANODE", pins: ["R1.pinB", "D1.pinAnode"] },
      { netId: "GND", pins: ["V1.pinNeg", "D1.pinCathode", "C1.pinB"] },
    ],
    components: [
      {
        type: "voltage_source",
        id: "V1",
        name: "DC Supply",
        pinPos: "pinPos",
        pinNeg: "pinNeg",
        voltage: supplyV,
      },
      {
        type: "resistor",
        id: "R1",
        name: `${formatOhms(ohms)} Resistor`,
        pinA: "pinA",
        pinB: "pinB",
        resistance: ohms,
        maxWatts: 0.25,
      },
      {
        type: "diode",
        id: "D1",
        name: `${led.label} LED`,
        pinAnode: "pinAnode",
        pinCathode: "pinCathode",
        forwardVoltage: led.forwardV,
        maxCurrentAmps: led.maxMa / 1000,
        isLed: true,
      },
      {
        type: "capacitor",
        id: "C1",
        name: "Filter Capacitor",
        pinA: "pinA",
        pinB: "pinB",
        capacitance: capUf * 1e-6,
        maxVolts: 16,
      },
    ],
  };

  const mna = solveCircuit(netlist);

  if (mna.failures.length > 0) {
    const primary = mna.failures[0];
    const burnedId = primary.componentId === "R1" ? "resistor" : "led";
    return {
      status: "FAULT",
      currentMilliamps: Math.round((mna.componentStates.R1?.current ?? 0) * 1000),
      burnedPartIds: [burnedId],
      litPartIds: [],
      details: mna.details,
      message: `[MNA Engine] ${primary.message}`,
    };
  }

  const d1 = mna.componentStates.D1;
  const currentMa = Math.round((d1?.current ?? 0) * 1000);
  const brightness = d1?.brightness ?? 0;

  if (supplyV <= led.forwardV) {
    return {
      status: "IDLE",
      currentMilliamps: 0,
      litPartIds: [],
      brightness: { led: 0 },
      details: mna.details,
      message: `[MNA Engine] ${supplyV} V is below the ${led.forwardV} V forward threshold of the ${led.label} LED.`,
    };
  }

  return {
    status: "RUNNING",
    currentMilliamps: currentMa,
    litPartIds: ["led"],
    brightness: { led: Math.min(1.3, brightness) },
    details: mna.details,
    message: `[MNA Engine] Circuit operating point converged: ${currentMa} mA flowing through ${led.label} LED (${(brightness * 100).toFixed(0)}% brightness).`,
  };
}

