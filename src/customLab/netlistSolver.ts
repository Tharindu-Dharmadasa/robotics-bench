// src/customLab/netlistSolver.ts

/**
 * Simple Union-Find (Disjoint Set) implementation for electrical netlist solving.
 */
class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  makeSet(x: string) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    if (!this.parent.has(x)) this.makeSet(x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return p;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra)!;
    const rankB = this.rank.get(rb)!;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }
}

import { CustomComponentType, PlacedCustomPart, CustomWire, CustomSimResult } from "./customTypes";

/** Helper to generate pin identifiers for a placed part */
function getPinIds(part: PlacedCustomPart): string[] {
  const pins: string[] = [];
  switch (part.type) {
    case "led_red":
    case "led_green":
      pins.push(`${part.id}:anode`, `${part.id}:cathode`);
      break;
    case "res_220":
    case "res_10":
    case "res_10k":
      pins.push(`${part.id}:a`, `${part.id}:b`);
      break;
    case "button":
      pins.push(`${part.id}:a`, `${part.id}:b`);
      break;
    case "npn_2n2222":
      pins.push(`${part.id}:c`, `${part.id}:b`, `${part.id}:e`);
      break;
    case "diode_1n4007":
      pins.push(`${part.id}:anode`, `${part.id}:cathode`);
      break;
    case "sg90_servo":
      pins.push(`${part.id}:VCC`, `${part.id}:GND`, `${part.id}:PWM`);
      break;
    case "oled_i2c":
      pins.push(`${part.id}:VCC`, `${part.id}:GND`, `${part.id}:SDA`, `${part.id}:SCL`);
      break;
    default:
      break;
  }
  return pins;
}

/** Main evaluator */
export function evaluateCustomCircuit(
  parts: PlacedCustomPart[],
  wires: CustomWire[],
  isPowered: boolean
): CustomSimResult {
  const uf = new UnionFind();
  const result: CustomSimResult = {
    status: "IDLE",
    burnedPartIds: [],
    shortedWireIds: [],
    activeWireIds: [],
    litLedIds: [],
    ledBrightness: {},
    servoActive: false,
    oledActive: false,
    nodeVoltages: {},
    logs: [],
  };

  // ----- Create base nodes -----
  // Breadboard vertical strips (col 1..30, top & bottom)
  for (let col = 1; col <= 30; col++) {
    uf.makeSet(`col${col}_top`);
    uf.makeSet(`col${col}_bottom`);
  }
  // Power rails
  uf.makeSet("rail_5V");
  uf.makeSet("rail_3V3");
  uf.makeSet("rail_GND");
  // Arduino Uno pins
  const unoPins = [
    "uno_5V",
    "uno_3V3",
    "uno_GND",
    "uno_D9",
    "uno_D13",
    "uno_SDA",
    "uno_SCL",
  ];
  for (const p of unoPins) uf.makeSet(p);

  // ----- Register part pins and attach to breadboard -----
  for (const part of parts) {
    const pins = getPinIds(part);
    // each pin becomes a node
    for (const pin of pins) uf.makeSet(pin);
    // connect each pin to the column strip where the part sits
    const columnNode = `col${part.gridCol}_${part.gridRow}`;
    for (const pin of pins) {
      uf.union(pin, columnNode);
    }
  }

  // ----- Merge wires -----
  for (const wire of wires) {
    uf.makeSet(wire.id);
    uf.union(wire.fromPinId, wire.toPinId);
    // also associate wire id with its two pins for later lookup
    // (store mapping) – we keep a map for later fault detection
  }

  // Helper to find root of a pin
  const root = (id: string) => uf.find(id);

  // ----- Fault: Short circuit 5V to GND -----
  if (root("uno_5V") === root("uno_GND")) {
    result.status = "FAULT";
    result.faultMessage = "SHORT CIRCUIT: 5V supply wired directly to GND!";
    // Identify wires that bridge the two nets – naive approach: any wire whose ends belong to the same net as both pins
    for (const wire of wires) {
      if (root(wire.fromPinId) === root("uno_5V") && root(wire.toPinId) === root("uno_GND")) {
        result.shortedWireIds.push(wire.id);
      }
    }
    // early exit – still continue to fill nodeVoltages for UI
  }

  // ----- LED burnout and lighting logic -----
  for (const part of parts) {
    if (part.type === "led_red" || part.type === "led_green") {
      const anode = `${part.id}:anode`;
      const cathode = `${part.id}:cathode`;
      const anodeNet = root(anode);
      const cathodeNet = root(cathode);
      const isAnode5V = anodeNet === root("rail_5V") || anodeNet === root("uno_5V");
      const isCathodeGND = cathodeNet === root("rail_GND") || cathodeNet === root("uno_GND");

      // Check for any series resistor between the nets
      let resistorFound = false;
      let resistorType: CustomComponentType | null = null;
      for (const r of parts) {
        if (r.type === "res_220" || r.type === "res_10k") {
          const a = `${r.id}:a`;
          const b = `${r.id}:b`;
          const aNet = root(a);
          const bNet = root(b);
          // resistor bridges 5V and GND nets
          if (
            (aNet === anodeNet && bNet === cathodeNet) ||
            (bNet === anodeNet && aNet === cathodeNet)
          ) {
            resistorFound = true;
            resistorType = r.type;
            break;
          }
        }
      }

      if (isAnode5V && isCathodeGND && !resistorFound) {
        // Overcurrent burnout
        result.status = "FAULT";
        result.faultMessage = "OVERCURRENT BURNOUT: LED connected across 5V without a >=100Ω current-limiting resistor!";
        result.burnedPartIds.push(part.id);
      } else if (isAnode5V && isCathodeGND && resistorFound) {
        // LED lights
        result.litLedIds.push(part.id);
        const brightness = resistorType === "res_220" ? 1.0 : 0.15;
        result.ledBrightness[part.id] = brightness;
        // Mark wires attached to the LED and resistor as active (naïve: any wire whose endpoints are in the same net as LED pins)
        for (const wire of wires) {
          const fNet = root(wire.fromPinId);
          const tNet = root(wire.toPinId);
          if (
            fNet === anodeNet || fNet === cathodeNet || tNet === anodeNet || tNet === cathodeNet
          ) {
            if (!result.activeWireIds.includes(wire.id)) result.activeWireIds.push(wire.id);
          }
        }
      }
    }
  }

  // ----- Servo activation -----
  const servo = parts.find((p) => p.type === "sg90_servo");
  if (servo) {
    const vcc = `${servo.id}:VCC`;
    const gnd = `${servo.id}:GND`;
    const pwm = `${servo.id}:PWM`;
    if (
      root(vcc) === root("rail_5V") &&
      root(gnd) === root("uno_GND") &&
      root(pwm) === root("uno_D9")
    ) {
      result.servoActive = true;
    }
  }

  // ----- OLED activation -----
  const oled = parts.find((p) => p.type === "oled_i2c");
  if (oled) {
    const vcc = `${oled.id}:VCC`;
    const gnd = `${oled.id}:GND`;
    const sda = `${oled.id}:SDA`;
    const scl = `${oled.id}:SCL`;
    if (
      root(vcc) === root("rail_5V") &&
      root(gnd) === root("uno_GND") &&
      root(sda) === root("uno_SDA") &&
      root(scl) === root("uno_SCL")
    ) {
      result.oledActive = true;
    }
  }

  // ----- Populate node voltages -----
  const voltageMap = new Map<string, string>([
    [root("rail_5V"), "5.00V"],
    [root("rail_3V3"), "3.30V"],
    [root("rail_GND"), "0.00V (GND)"],
    [root("uno_D9"), "PWM 50Hz"],
  ]);

  // Register all pins (part pins + Arduino pins) for UI probing
  const allPinIds: string[] = [];
  for (const part of parts) {
    allPinIds.push(...getPinIds(part));
  }
  allPinIds.push(...unoPins);
  for (const id of allPinIds) {
    const r = root(id);
    const volts = voltageMap.get(r) ?? "FLOATING";
    result.nodeVoltages[id] = volts;
  }

  // Set final status if not fault
  if (result.status !== "FAULT") {
    result.status = isPowered ? "RUNNING" : "IDLE";
  }

  return result;
}
