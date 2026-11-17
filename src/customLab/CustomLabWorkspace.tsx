// src/customLab/CustomLabWorkspace.tsx

/**
 * Custom Experiment Bench (sandbox) workspace.
 *
 * Mounted by App as a FULL-SCREEN overlay (fixed inset-0 z-50) so the 3D
 * breadboard gets the entire window instead of sharing space with the 13-lab
 * sidebar and bottom panels. Layout:
 *   • top-bar header — back button, mode/preset controls, power/repair/clear
 *   • left control palette — tool modes, component cards, starter presets
 *   • 3D breadboard viewport (CustomViewport) filling the rest
 *
 * All sandbox state (mode, selection, parts, wires, power, simulation) lives
 * here and is pushed down into CustomViewport as props.
 *
 * NOTE: No @react-three/drei <Html> or <Text> components are used inside
 * <Canvas>, per the strict project rule — labels live in the 2D HUD overlay.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Cable,
  CircuitBoard,
  Eraser,
  Gauge,
  MousePointerClick,
  Power,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import CustomViewport from "./CustomViewport";
import type {
  CustomComponentType,
  CustomSimResult,
  CustomWire,
  PlacedCustomPart,
} from "./customTypes";

/* ---------------------------------- types --------------------------------- */

type CustomMode = "place" | "wire" | "probe" | "remove";

/* ------------------------------ static config ----------------------------- */

/** Human label per component type (also used as the placed part's name). */
const PART_LABELS: Record<CustomComponentType, string> = {
  led_red: "Red LED (5 mm)",
  led_green: "Green LED (5 mm)",
  res_220: "220 Ω Resistor",
  res_10: "10 Ω Resistor",
  res_10k: "10 kΩ Resistor",
  button: "Tactile Push Button",
  npn_2n2222: "2N2222 NPN (TO-92)",
  diode_1n4007: "1N4007 Diode",
  sg90_servo: "SG90 Servo",
  oled_i2c: "SSD1306 OLED (I²C)",
};

/** How many adjacent breadboard columns each part's legs span. */
const PART_LEG_SPAN: Record<CustomComponentType, number> = {
  led_red: 2,
  led_green: 2,
  res_220: 2,
  res_10: 2,
  res_10k: 2,
  button: 2,
  npn_2n2222: 3,
  diode_1n4007: 2,
  sg90_servo: 3,
  oled_i2c: 4,
};

/** Solver pin suffixes per part type, in leg order (left → right). */
const PART_LEG_PINS: Record<CustomComponentType, string[]> = {
  led_red: ["anode", "cathode"],
  led_green: ["anode", "cathode"],
  res_220: ["a", "b"],
  res_10: ["a", "b"],
  res_10k: ["a", "b"],
  button: ["a", "b"],
  npn_2n2222: ["c", "b", "e"],
  diode_1n4007: ["anode", "cathode"],
  sg90_servo: ["VCC", "GND", "PWM"],
  oled_i2c: ["VCC", "GND", "SDA", "SCL"],
};

const MODE_BUTTONS: Array<{ mode: CustomMode; label: string; icon: LucideIcon }> = [
  { mode: "place", label: "Place Component", icon: MousePointerClick },
  { mode: "wire", label: "Route Jumper Wire", icon: Cable },
  { mode: "probe", label: "Multimeter Probe", icon: Gauge },
  { mode: "remove", label: "Remove Part / Wire", icon: Trash2 },
];

const CATALOG: Array<{
  type: CustomComponentType;
  label: string;
  sub: string;
  swatch: string;
}> = [
  { type: "led_red", label: "Red LED", sub: "5 mm indicator", swatch: "#ff4444" },
  { type: "led_green", label: "Green LED", sub: "5 mm indicator", swatch: "#37d67a" },
  { type: "res_220", label: "220 Ω Resistor", sub: "LED current limit", swatch: "#e7d5a4" },
  { type: "res_10", label: "10 Ω Resistor", sub: "⚠ too small for LEDs", swatch: "#c9a227" },
  { type: "res_10k", label: "10 kΩ Resistor", sub: "LED starved · dim", swatch: "#d9c79a" },
  { type: "button", label: "Push Button", sub: "tactile · momentary", swatch: "#38bdf8" },
  { type: "npn_2n2222", label: "2N2222 NPN", sub: "TO-92 · switch", swatch: "#334155" },
  { type: "diode_1n4007", label: "1N4007 Diode", sub: "1 A · flyback", swatch: "#111827" },
  { type: "sg90_servo", label: "SG90 Servo", sub: "docks in right bay", swatch: "#2563eb" },
  { type: "oled_i2c", label: "I²C OLED", sub: "docks in right bay", swatch: "#0f172a" },
];

const PRESETS: Array<{
  id: "safe-led" | "burnout" | "servo-oled";
  label: string;
  desc: string;
}> = [
  { id: "safe-led", label: "Safe LED + 220 Ω", desc: "LED lights at full brightness" },
  { id: "burnout", label: "Overcurrent Burnout Demo", desc: "LED pops the moment power flows" },
  { id: "servo-oled", label: "SG90 Servo + OLED Rig", desc: "Servo sweep + glowing display" },
];

const WIRE_COLORS = ["#e23b3b", "#2f7de1", "#f0b429", "#2ea44f", "#8b5cf6", "#111827"];

let uidCounter = 0;
const uid = () => `${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;

const mkPart = (
  type: CustomComponentType,
  gridCol: number,
  gridRow: "top" | "bottom",
): PlacedCustomPart => ({
  id: `${type}_${uid()}`,
  type,
  name: PART_LABELS[type],
  gridCol,
  gridRow,
});

const mkWire = (fromPinId: string, toPinId: string, index: number): CustomWire => ({
  id: `wire_${uid()}`,
  fromPinId,
  toPinId,
  color: WIRE_COLORS[index % WIRE_COLORS.length],
});

/* --------------------------- local circuit solver -------------------------- */

/** Tiny union-find used by the sandbox netlist evaluator. */
class SandboxUnionFind {
  private parent = new Map<string, string>();
  makeSet(x: string) {
    if (!this.parent.has(x)) this.parent.set(x, x);
  }
  find(x: string): string {
    this.makeSet(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/** Whole-length power rails: `rail_5V_col7` is the same net as `rail_5V`. */
const normalizePin = (pin: string) =>
  pin.replace(/^(rail_(?:5V|3V3|GND))_col\d+$/, "$1");

/**
 * Sandbox netlist evaluator. Each part attaches leg #i to column
 * `gridCol + i` (a real part spans adjacent breadboard columns), wires merge
 * nets, and a powered circuit is checked for 5 V↔GND shorts, LED overcurrent
 * burnout, series resistors, servo drive and I²C OLED wiring.
 */
function solveCustomCircuit(
  parts: PlacedCustomPart[],
  wires: CustomWire[],
  powered: boolean,
): CustomSimResult {
  const uf = new SandboxUnionFind();
  const baseNodes = [
    "rail_5V",
    "rail_3V3",
    "rail_GND",
    "uno_5V",
    "uno_3V3",
    "uno_GND",
    "uno_D9",
    "uno_D13",
    "uno_SDA",
    "uno_SCL",
  ];
  baseNodes.forEach((n) => uf.makeSet(n));
  for (let col = 1; col <= 30; col++) {
    uf.makeSet(`col${col}_top`);
    uf.makeSet(`col${col}_bottom`);
    // rail tie-points are electrically continuous along each rail
    uf.union(`rail_5V_col${col}`, "rail_5V");
    uf.union(`rail_3V3_col${col}`, "rail_3V3");
    uf.union(`rail_GND_col${col}`, "rail_GND");
  }
  for (const part of parts) {
    PART_LEG_PINS[part.type].forEach((leg, i) => {
      const pin = `${part.id}:${leg}`;
      uf.makeSet(pin);
      uf.union(pin, `col${part.gridCol + i}_${part.gridRow}`);
    });
  }
  for (const w of wires) uf.union(normalizePin(w.fromPinId), normalizePin(w.toPinId));

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
  const root = (id: string) => uf.find(id);

  const SUPPLY = ["rail_5V", "uno_5V"];
  const GROUND = ["rail_GND", "uno_GND"];
  const netIsSupply = (pin: string) =>
    SUPPLY.some((s) => root(normalizePin(pin)) === root(s));
  const netIsGround = (pin: string) =>
    GROUND.some((g) => root(normalizePin(pin)) === root(g));

  const activeNetRoots = new Set<string>();
  let faulted = false;

  if (powered) {
    // ----- Fault: a jumper wiring 5 V straight to GND -----
    for (const w of wires) {
      const shorted =
        (netIsSupply(w.fromPinId) && netIsGround(w.toPinId)) ||
        (netIsGround(w.fromPinId) && netIsSupply(w.toPinId));
      if (shorted && !result.shortedWireIds.includes(w.id)) {
        result.shortedWireIds.push(w.id);
      }
    }
    if (result.shortedWireIds.length) {
      faulted = true;
      result.faultMessage = "SHORT CIRCUIT: a jumper wires 5 V straight to GND!";
    }

    // ----- LED lighting / overcurrent burnout -----
    for (const part of parts) {
      if (part.type !== "led_red" && part.type !== "led_green") continue;
      const aNet = root(`${part.id}:anode`);
      const cNet = root(`${part.id}:cathode`);
      const anodeSupply = SUPPLY.some((s) => root(s) === aNet);
      const cathodeGround = GROUND.some((g) => root(g) === cNet);

      // series resistor between the supply and the anode, or cathode and GND
      let series: CustomComponentType | null = null;
      for (const r of parts) {
        if (r.type !== "res_220" && r.type !== "res_10" && r.type !== "res_10k")
          continue;
        const ra = root(`${r.id}:a`);
        const rb = root(`${r.id}:b`);
        const bridge =
          (ra === aNet && SUPPLY.some((s) => root(s) === rb)) ||
          (rb === aNet && SUPPLY.some((s) => root(s) === ra)) ||
          (ra === cNet && GROUND.some((g) => root(g) === rb)) ||
          (rb === cNet && GROUND.some((g) => root(g) === ra));
        if (bridge) {
          series = r.type;
          activeNetRoots.add(ra);
          activeNetRoots.add(rb);
          break;
        }
      }

      if (anodeSupply && cathodeGround) {
        faulted = true;
        result.faultMessage =
          "OVERCURRENT BURNOUT: LED across 5 V with no current-limiting resistor!";
        result.burnedPartIds.push(part.id);
        activeNetRoots.add(aNet);
        activeNetRoots.add(cNet);
      } else if (series && (anodeSupply || cathodeGround)) {
        activeNetRoots.add(aNet);
        activeNetRoots.add(cNet);
        if (series === "res_10") {
          faulted = true;
          result.faultMessage =
            "OVERCURRENT BURNOUT: 10 Ω limiting lets far too much current through the LED!";
          result.burnedPartIds.push(part.id);
        } else {
          result.litLedIds.push(part.id);
          result.ledBrightness[part.id] = series === "res_220" ? 1.0 : 0.15;
        }
      }
    }

    // ----- Servo drive (VCC → 5 V, GND, PWM → D9) -----
    const servo = parts.find((p) => p.type === "sg90_servo");
    if (servo) {
      const vcc = root(`${servo.id}:VCC`);
      const gnd = root(`${servo.id}:GND`);
      const pwm = root(`${servo.id}:PWM`);
      if (
        SUPPLY.some((s) => root(s) === vcc) &&
        GROUND.some((g) => root(g) === gnd) &&
        root("uno_D9") === pwm
      ) {
        result.servoActive = true;
        [vcc, gnd, pwm].forEach((n) => activeNetRoots.add(n));
      }
    }

    // ----- OLED drive (VCC → 5 V, GND, SDA/SCL → I²C header) -----
    const oled = parts.find((p) => p.type === "oled_i2c");
    if (oled) {
      const vcc = root(`${oled.id}:VCC`);
      const gnd = root(`${oled.id}:GND`);
      const sda = root(`${oled.id}:SDA`);
      const scl = root(`${oled.id}:SCL`);
      if (
        SUPPLY.some((s) => root(s) === vcc) &&
        GROUND.some((g) => root(g) === gnd) &&
        root("uno_SDA") === sda &&
        root("uno_SCL") === scl
      ) {
        result.oledActive = true;
        [vcc, gnd, sda, scl].forEach((n) => activeNetRoots.add(n));
      }
    }

    // ----- Wires carrying current (naive: touching an active net) -----
    for (const w of wires) {
      const rf = root(normalizePin(w.fromPinId));
      const rt = root(normalizePin(w.toPinId));
      if (
        (activeNetRoots.has(rf) || activeNetRoots.has(rt)) &&
        !result.activeWireIds.includes(w.id)
      ) {
        result.activeWireIds.push(w.id);
      }
    }
  }

  // ----- Node voltages (for the multimeter probe) -----
  const voltsByRoot = new Map<string, string>([
    [root("rail_5V"), "5.00 V"],
    [root("uno_5V"), "5.00 V"],
    [root("rail_3V3"), "3.30 V"],
    [root("uno_3V3"), "3.30 V"],
    [root("rail_GND"), "0.00 V (GND)"],
    [root("uno_GND"), "0.00 V (GND)"],
    [root("uno_D9"), powered ? "PWM 50 Hz" : "0.00 V (LOW)"],
    [root("uno_D13"), "D13 digital"],
    [root("uno_SDA"), "I²C data"],
    [root("uno_SCL"), "I²C clock"],
  ]);
  const probeIds = new Set<string>();
  for (let col = 1; col <= 30; col++) {
    probeIds.add(`col${col}_top`);
    probeIds.add(`col${col}_bottom`);
    probeIds.add(`rail_5V_col${col}`);
    probeIds.add(`rail_GND_col${col}`);
  }
  baseNodes.forEach((n) => probeIds.add(n));
  for (const part of parts) {
    PART_LEG_PINS[part.type].forEach((leg) => probeIds.add(`${part.id}:${leg}`));
  }
  for (const w of wires) {
    probeIds.add(w.fromPinId);
    probeIds.add(w.toPinId);
  }
  for (const id of probeIds) {
    result.nodeVoltages[id] = voltsByRoot.get(root(id)) ?? "FLOATING";
  }

  result.status = faulted ? "FAULT" : powered ? "RUNNING" : "IDLE";
  return result;
}

/* ------------------------------- component -------------------------------- */

export default function CustomLabWorkspace({ onClose }: CustomLabWorkspaceProps) {
  const [mode, setMode] = useState<CustomMode>("place");
  const [selectedComponent, setSelectedComponent] =
    useState<CustomComponentType | null>("led_red");
  const [parts, setParts] = useState<PlacedCustomPart[]>([]);
  const [wires, setWires] = useState<CustomWire[]>([]);
  const [powered, setPowered] = useState(false);
  const [wireStartPin, setWireStartPin] = useState<string | null>(null);
  const [probeReadout, setProbeReadout] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "> Sandbox ready. Pick a component, then click a breadboard column.",
  ]);

  const simResult = useMemo(
    () => solveCustomCircuit(parts, wires, powered),
    [parts, wires, powered],
  );

  const log = (s: string) => setLogs((l) => [...l.slice(-40), s]);

  const pickMode = (m: CustomMode) => {
    setMode(m);
    if (m !== "wire") setWireStartPin(null);
  };

  const pickComponent = (type: CustomComponentType) => {
    setSelectedComponent(type);
    setMode("place");
    log(`> ${PART_LABELS[type]} selected — click a breadboard column to seat it.`);
  };

  /** Clicking a breadboard pin (column, rail tie-point or Arduino header). */
  const handlePinClick = (pinId: string) => {
    if (mode === "remove") return;

    if (mode === "probe") {
      const v = simResult.nodeVoltages[pinId] ?? "FLOATING";
      setProbeReadout(`${pinId} = ${v}`);
      log(`> Probe ${pinId}: ${v}`);
      return;
    }

    if (mode === "wire") {
      if (!wireStartPin) {
        setWireStartPin(pinId);
        log(`> Wire start: ${pinId} — now click the destination pin.`);
      } else if (wireStartPin === pinId) {
        setWireStartPin(null);
        log("> Wire cancelled.");
      } else {
        const id = `wire_${uid()}`;
        const wire: CustomWire = {
          id,
          fromPinId: wireStartPin,
          toPinId: pinId,
          color: WIRE_COLORS[wires.length % WIRE_COLORS.length],
        };
        setWires((w) => [...w, wire]);
        log(`> Jumper routed ${wireStartPin} → ${pinId}.`);
        setWireStartPin(null);
      }
      return;
    }

    // place mode
    if (!selectedComponent) {
      log("! Select a component card first.");
      return;
    }
    const m = pinId.match(/^col(\d+)_(top|bottom)$/);
    if (!m) {
      log("! Components seat on the column tie-points — pick a numbered column.");
      return;
    }
    const col = parseInt(m[1], 10);
    const row = m[2] as "top" | "bottom";
    const span = PART_LEG_SPAN[selectedComponent];
    if (col + span - 1 > 30) {
      log(
        `! ${PART_LABELS[selectedComponent]} needs ${span} adjacent columns — try further left.`,
      );
      return;
    }
    const clash = parts.some(
      (p) =>
        p.gridRow === row &&
        col < p.gridCol + PART_LEG_SPAN[p.type] &&
        p.gridCol < col + span,
    );
    if (clash) {
      log("! That column is occupied — pick a free spot.");
      return;
    }
    const part: PlacedCustomPart = {
      id: `${selectedComponent}_${uid()}`,
      type: selectedComponent,
      name: PART_LABELS[selectedComponent],
      gridCol: col,
      gridRow: row,
    };
    setParts((p) => [...p, part]);
    log(`> Placed ${part.name} at column ${col} (${row} half).`);
  };

  const applyPreset = (id: "safe-led" | "burnout" | "servo-oled") => {
    let nextParts: PlacedCustomPart[] = [];
    let nextWires: CustomWire[] = [];
    if (id === "safe-led") {
      nextParts = [mkPart("res_220", 8, "bottom"), mkPart("led_red", 12, "bottom")];
      nextWires = [
        mkWire("rail_5V_col8", "col8_bottom", 0),
        mkWire("col9_bottom", "col12_bottom", 1),
        mkWire("col13_bottom", "rail_GND_col13", 2),
      ];
    } else if (id === "burnout") {
      nextParts = [mkPart("led_red", 18, "bottom")];
      nextWires = [
        mkWire("rail_5V_col18", "col18_bottom", 0),
        mkWire("col19_bottom", "rail_GND_col19", 1),
      ];
    } else {
      nextParts = [
        mkPart("sg90_servo", 5, "top"),
        mkPart("oled_i2c", 10, "top"),
      ];
      nextWires = [
        mkWire("rail_5V_col5", "col5_top", 0),
        mkWire("col6_top", "rail_GND_col6", 1),
        mkWire("col7_top", "uno_D9", 2),
        mkWire("rail_5V_col10", "col10_top", 3),
        mkWire("col11_top", "rail_GND_col11", 4),
        mkWire("col12_top", "uno_SDA", 5),
        mkWire("col13_top", "uno_SCL", 6),
      ];
    }
    setParts(nextParts);
    setWires(nextWires);
    setPowered(true);
    setWireStartPin(null);
    setProbeReadout(null);
    const label = PRESETS.find((p) => p.id === id)?.label ?? id;
    log(`> Preset "${label}" loaded and powered — inspect the board.`);
  };

  const togglePower = () => {
    const next = !powered;
    setPowered(next);
    log(next ? "> Power ON — 5 V rail live." : "> Power OFF.");
  };

  const repairBench = () => {
    const burned = simResult.burnedPartIds;
    const shorted = simResult.shortedWireIds;
    if (!burned.length && !shorted.length) {
      log("> Nothing damaged — bench is healthy.");
      return;
    }
    if (burned.length) {
      setParts((p) => p.filter((pt) => !burned.includes(pt.id)));
    }
    if (shorted.length) {
      setWires((w) => w.filter((wr) => !shorted.includes(wr.id)));
    }
    log(
      `> Repaired: ${burned.length} burned part(s) replaced, ${shorted.length} shorted jumper(s) removed.`,
    );
  };

  const clearBench = () => {
    setParts([]);
    setWires([]);
    setPowered(false);
    setWireStartPin(null);
    setProbeReadout(null);
    log("> Bench cleared — bare breadboard, power off.");
  };

  const statusColor =
    simResult.status === "FAULT"
      ? "#ff8484"
      : simResult.status === "RUNNING"
        ? "#7ce38b"
        : "#c8c4bc";

  return (
    <div className="fixed inset-0 z-50 flex w-screen h-screen flex-col bg-[#EAE6DF] font-mono text-[#1E1E1C]">
      {/* ── Top-bar header ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1E1E1C] bg-[#1E1E1C] px-4 py-2 text-[#EAE6DF]">
        {/* left: back + title */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onClose}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#555] px-3 py-1.5 text-xs font-bold transition hover:bg-[#333]"
          >
            <ArrowLeft size={14} />
            Back to 13 Guided Labs
          </button>
          <div className="hidden items-center gap-2 text-sm font-bold lg:flex">
            <CircuitBoard size={16} />
            Custom Experiment Bench — Sandbox
          </div>
        </div>

        {/* center: mode + preset controls */}
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-md border border-[#444] p-1 md:flex">
            {MODE_BUTTONS.map(({ mode: m, label, icon: Icon }) => (
              <button
                key={m}
                onClick={() => pickMode(m)}
                title={label}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition ${
                  mode === m
                    ? "bg-[#EAE6DF] text-[#1E1E1C]"
                    : "text-[#c8c4bc] hover:bg-[#333]"
                }`}
              >
                <Icon size={13} />
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-1 rounded-md border border-[#444] p-1 lg:flex">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                title={p.desc}
                className="rounded px-2 py-1 text-[11px] text-[#c8c4bc] transition hover:bg-[#333] hover:text-[#EAE6DF]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* right: power / repair / clear */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={togglePower}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              powered
                ? "bg-[#7ce38b] text-[#123519] hover:bg-[#9df0a8]"
                : "bg-[#2f7de1] text-white hover:bg-[#4a90ec]"
            }`}
          >
            <Power size={14} />
            {powered ? "Power Off" : "Power On / Run"}
          </button>
          <button
            onClick={repairBench}
            className="flex items-center gap-1.5 rounded-md border border-[#f0b429]/60 px-3 py-1.5 text-xs font-bold text-[#f0b429] transition hover:bg-[#f0b429]/15"
          >
            <Wrench size={14} />
            Repair / Reset
          </button>
          <button
            onClick={clearBench}
            className="flex items-center gap-1.5 rounded-md border border-[#ff8888]/60 px-3 py-1.5 text-xs font-bold text-[#ff8888] transition hover:bg-[#ff8888]/15"
          >
            <Eraser size={14} />
            Clear Bench
          </button>
        </div>
      </div>

      {/* ── Body: left palette + 3D viewport ───────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 space-y-4 overflow-y-auto border-r border-[#1E1E1C] bg-[#1E1E1C] p-3 text-xs leading-snug text-[#EAE6DF]">
          {/* tool modes */}
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#999]">
              Tool modes
            </h2>
            <div className="space-y-1">
              {MODE_BUTTONS.map(({ mode: m, label, icon: Icon }) => (
                <button
                  key={m}
                  onClick={() => pickMode(m)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
                    mode === m
                      ? "border-[#7ce38b] bg-[#7ce38b]/10 text-[#7ce38b]"
                      : "border-[#3a3a38] text-[#c8c4bc] hover:border-[#555] hover:bg-[#2a2a28]"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* component palette */}
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#999]">
              Component palette
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {CATALOG.map((c) => (
                <button
                  key={c.type}
                  onClick={() => pickComponent(c.type)}
                  className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-left transition ${
                    selectedComponent === c.type
                      ? "border-[#f0b429] bg-[#f0b429]/10"
                      : "border-[#3a3a38] hover:border-[#555] hover:bg-[#2a2a28]"
                  }`}
                >
                  <span
                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-black/40"
                    style={{ background: c.swatch }}
                  />
                  <span className="min-w-0">
                    <span className="block font-bold text-[#EAE6DF]">{c.label}</span>
                    <span className="block text-[10px] text-[#999]">{c.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* starter presets */}
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#999]">
              Starter presets
            </h2>
            <div className="space-y-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className="block w-full rounded-md border border-[#3a3a38] px-2.5 py-1.5 text-left transition hover:border-[#2f7de1] hover:bg-[#2f7de1]/10"
                >
                  <span className="block font-bold text-[#8ec2ff]">{p.label}</span>
                  <span className="block text-[10px] text-[#999]">{p.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* live readout */}
          <section className="space-y-1 rounded-md border border-[#3a3a38] p-2 text-[11px] text-[#c8c4bc]">
            <div className="flex justify-between">
              <span className="text-[#999]">Status</span>
              <span className="font-bold" style={{ color: statusColor }}>
                {simResult.status}
              </span>
            </div>
            {simResult.faultMessage && (
              <div className="text-[#ff8484]">⚠ {simResult.faultMessage}</div>
            )}
            <div className="flex justify-between">
              <span className="text-[#999]">Power</span>
              <span className={powered ? "text-[#7ce38b]" : ""}>
                {powered ? "ON · 5 V rail live" : "OFF"}
              </span>
            </div>
            {mode === "wire" && (
              <div className="text-[#f0b429]">
                {wireStartPin
                  ? `Wire start: ${wireStartPin} → click destination`
                  : "Click a start pin on the board"}
              </div>
            )}
            {probeReadout && (
              <div className="text-[#fbbf24]">🔎 {probeReadout}</div>
            )}
          </section>

          <section className="rounded-md border border-[#3a3a38] p-2 text-[11px] text-[#c8c4bc]">
            Power rails (
            <span className="text-[#ff8888]">5 V</span> /{" "}
            <span className="text-[#8888ff]">GND</span>) run along the top and
            bottom edges; the Arduino header strip sits on the left with 5 V,
            3V3, GND, D9, D13, SDA and SCL pins. The SG90 servo and OLED dock
            in the bay on the right.
          </section>
        </aside>

        <div className="relative min-w-0 flex-1">
          <CustomViewport
            mode={mode}
            selectedLabel={selectedComponent ? PART_LABELS[selectedComponent] : null}
            parts={parts}
            wires={wires}
            simResult={simResult}
            powered={powered}
            wireStartPin={wireStartPin}
            probeReadout={probeReadout}
            hudLines={logs}
            onPinClick={handlePinClick}
            onRemovePart={(partId) => {
              const part = parts.find((p) => p.id === partId);
              setParts((p) => p.filter((x) => x.id !== partId));
              if (part) log(`> Removed ${part.name}.`);
            }}
            onRemoveWire={(wireId) => {
              setWires((w) => w.filter((x) => x.id !== wireId));
              log("> Jumper wire removed.");
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface CustomLabWorkspaceProps {
  /** Back to the standard board stage (App: setShowCustomLab(false)). */
  onClose: () => void;
}
