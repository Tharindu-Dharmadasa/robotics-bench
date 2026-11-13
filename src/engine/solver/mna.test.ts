import { describe, expect, it } from "vitest";
import { solveCircuit } from "./mnaSolver";
import type { CircuitNetlist } from "./types";

describe("MNA Circuit Solver", () => {
  it("solves a simple voltage divider circuit", () => {
    // 10V supply across R1 (1k) and R2 (1k) to GND -> Midpoint should be 5.0V
    const netlist: CircuitNetlist = {
      groundNetId: "GND",
      nets: [
        { netId: "VCC", pins: ["V1.pinPos", "R1.pinA"] },
        { netId: "MID", pins: ["R1.pinB", "R2.pinA"] },
        { netId: "GND", pins: ["V1.pinNeg", "R2.pinB"] },
      ],
      components: [
        {
          type: "voltage_source",
          id: "V1",
          name: "10V Supply",
          pinPos: "pinPos",
          pinNeg: "pinNeg",
          voltage: 10,
        },
        {
          type: "resistor",
          id: "R1",
          name: "R1",
          pinA: "pinA",
          pinB: "pinB",
          resistance: 1000,
          maxWatts: 0.25,
        },
        {
          type: "resistor",
          id: "R2",
          name: "R2",
          pinA: "pinA",
          pinB: "pinB",
          resistance: 1000,
          maxWatts: 0.25,
        },
      ],
    };

    const result = solveCircuit(netlist);

    expect(result.nodeVoltages["GND"]).toBe(0);
    expect(result.nodeVoltages["VCC"]).toBeCloseTo(10, 1);
    expect(result.nodeVoltages["MID"]).toBeCloseTo(5.0, 1);

    // Current = 10V / 2000 ohm = 5 mA
    const r1State = result.componentStates["R1"];
    expect(r1State.current).toBeCloseTo(0.005, 3);
    expect(r1State.voltageDrop).toBeCloseTo(5.0, 1);
    expect(r1State.powerDissipated).toBeCloseTo(0.025, 3); // 25 mW
    expect(result.failures).toHaveLength(0);
  });

  it("detects resistor overpower failure when P > maxWatts", () => {
    // 12V across a small 10 ohm resistor -> P = V^2 / R = 144 / 10 = 14.4 W (way above 0.25 W)
    const netlist: CircuitNetlist = {
      groundNetId: "GND",
      nets: [
        { netId: "VCC", pins: ["V1.pinPos", "R1.pinA"] },
        { netId: "GND", pins: ["V1.pinNeg", "R1.pinB"] },
      ],
      components: [
        {
          type: "voltage_source",
          id: "V1",
          name: "12V Supply",
          pinPos: "pinPos",
          pinNeg: "pinNeg",
          voltage: 12,
        },
        {
          type: "resistor",
          id: "R1",
          name: "Shunt Resistor",
          pinA: "pinA",
          pinB: "pinB",
          resistance: 10,
          maxWatts: 0.25,
        },
      ],
    };

    const result = solveCircuit(netlist);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].componentId).toBe("R1");
    expect(result.failures[0].failureType).toBe("OVERPOWER");
    expect(result.failures[0].measuredValue).toBeGreaterThan(14);
  });

  it("simulates LED with series resistor (Ohm's Law with forward drop)", () => {
    // 5V supply -> 330 ohm resistor -> Red LED (Vf = 2.0V, rated 20mA) -> GND
    // I = (5V - 2.0V) / 330 ohm = ~9.1 mA
    const netlist: CircuitNetlist = {
      groundNetId: "GND",
      nets: [
        { netId: "VCC", pins: ["V1.pinPos", "R1.pinA"] },
        { netId: "ANODE", pins: ["R1.pinB", "D1.pinAnode"] },
        { netId: "GND", pins: ["V1.pinNeg", "D1.pinCathode"] },
      ],
      components: [
        {
          type: "voltage_source",
          id: "V1",
          name: "5V Header",
          pinPos: "pinPos",
          pinNeg: "pinNeg",
          voltage: 5,
        },
        {
          type: "resistor",
          id: "R1",
          name: "Series Resistor",
          pinA: "pinA",
          pinB: "pinB",
          resistance: 330,
          maxWatts: 0.25,
        },
        {
          type: "diode",
          id: "D1",
          name: "Red LED",
          pinAnode: "pinAnode",
          pinCathode: "pinCathode",
          forwardVoltage: 2.0,
          maxCurrentAmps: 0.02,
          isLed: true,
        },
      ],
    };

    const result = solveCircuit(netlist);

    expect(result.nodeVoltages["VCC"]).toBeCloseTo(5.0, 1);
    expect(result.nodeVoltages["ANODE"]).toBeGreaterThanOrEqual(2.0);

    const ledState = result.componentStates["D1"];
    expect(ledState.state).toBe("CONDUCTING");
    expect(ledState.current).toBeGreaterThan(0.007);
    expect(ledState.current).toBeLessThan(0.012);
    expect(result.failures).toHaveLength(0);
  });

  it("detects LED burnout failure under overcurrent", () => {
    // 5V supply connected directly to Red LED without a current limiting resistor
    const netlist: CircuitNetlist = {
      groundNetId: "GND",
      nets: [
        { netId: "VCC", pins: ["V1.pinPos", "D1.pinAnode"] },
        { netId: "GND", pins: ["V1.pinNeg", "D1.pinCathode"] },
      ],
      components: [
        {
          type: "voltage_source",
          id: "V1",
          name: "5V Header",
          pinPos: "pinPos",
          pinNeg: "pinNeg",
          voltage: 5,
        },
        {
          type: "diode",
          id: "D1",
          name: "Red LED",
          pinAnode: "pinAnode",
          pinCathode: "pinCathode",
          forwardVoltage: 2.0,
          maxCurrentAmps: 0.02,
          isLed: true,
        },
      ],
    };

    const result = solveCircuit(netlist);

    expect(result.failures.some((f) => f.componentId === "D1" && f.failureType === "OVERCURRENT")).toBe(true);
  });
});

