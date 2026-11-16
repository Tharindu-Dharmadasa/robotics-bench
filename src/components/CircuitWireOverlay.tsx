import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PCB_T } from "../data/boards";
import type { BoardSpec } from "../types/simulator";

/**
 * CircuitWireOverlay — non-breaking 3D jumper-wire layer for Figs. 01–05.
 *
 * Renders arched jumper wires (TubeGeometry with black Dupont end-boots)
 * between exact pin-to-component board coordinates, and glides directional
 * arrow cones along each wire (rotated along curve.getTangentAt(t)) whenever
 * that specific loop is electrically closed and energized. Remove any part a
 * loop needs and its wires + arrows stop immediately.
 *
 * AGENTS.md rule 1: pure procedural three.js — no <Html>/<Text> inside <Canvas>.
 */

/* ---------- wire-rail data model ---------- */

/** One endpoint of a wire run, in bench board coordinates. */
interface WNode {
  /** anchor on a board part (x/z from spec.parts[].p) */
  part?: string;
  /** lateral offset from the part anchor (board units) */
  dx?: number;
  dz?: number;
  /** absolute coordinate added to the anchor (off-part pins, rails, buses) */
  x?: number;
  z?: number;
  /** connection height above the PCB top surface (bench units) */
  y?: number;
}



interface WRun {
  id: string;
  /** every loop this run carries current for (a run may be shared) */
  loops: string[];
  a: WNode;
  b: WNode;
  /** insulation colour */
  color: string;
}

/** How a closed loop is energized. */
type Gate =
  | "always" // powered bench (usb + soldered + fully placed, no active fault)
  | "running" // powered + sketch running
  | "blink" // powered + running + D13/branch HIGH half-cycle
  | "d9"; // Fig. 03 only: D9 held HIGH with the control/load loop complete

interface WLoop {
  id: string;
  /** board id (1-based = Fig. number) */
  fig: number;
  /** part ids that must all be placed, or the loop is open (no wires, no flow) */
  needs: string[];
  gate: Gate;
}

/* ---------- palette ---------- */

const RED = "#d64b3a";
const BLACK = "#22252a";
const YELLOW = "#e0b33a";
const GREEN = "#2f7d46";
const BLUE = "#2b6bff";
const ORANGE = "#ff8c1a";
const GREY = "#9a948a";

const WIRE_R = 0.032;
const BOOT_R = 0.052;
const BOOT_LEN = 0.26;
const UP = new THREE.Vector3(0, 1, 0);

/** Part-anchored node at lead height. */
const P = (part: string, o: Partial<WNode> = {}): WNode => ({
  part,
  y: 0.3,
  ...o,
});
/** Absolute pin / rail / bus node (e.g. a header pin or breadboard power rail). */
const Pin = (x: number, z: number, y = 0.5): WNode => ({ x, z, y });

/* ---------- loops & runs, Figs. 01–05 ----------
 *
 * Pin coordinates match the real headers: 0.25" pitch (0.25 bench units),
 * pins centred on the header part position.
 *   Uno power header hp  (-0.2,-2.4) n=8 : 5V = i4 → x −0.075 · GND = i5 → x 0.175
 *   Uno digital hd2      (-0.4, 2.4) n=10: D13 = i5 → x −0.275 · GND = i6 → x −0.025
 *   HC-SR04 h1 (-1.95,0) n=4 rot 90° along z: VCC .375 · TRIG .125 · ECHO −.125 · GND −.375
 */

const LOOPS: WLoop[] = [
  /* ---- Fig. 01 · Uno: USB 5V feed, D13 blink leg, always-on power LED ---- */
  {
    id: "uno-vbus",
    fig: 1,
    needs: ["usb", "fuse", "hp"],
    gate: "always",
  },
  {
    id: "uno-blink",
    fig: 1,
    needs: ["hd2", "r1", "ledl"],
    gate: "blink",
  },
  {
    id: "uno-on",
    fig: 1,
    needs: ["hp", "ledon"],
    gate: "always",
  },
  /* ---- Fig. 02 · breadboard: LED branch + signal leg ---- */
  {
    id: "bb-led",
    fig: 2,
    needs: ["j1", "r1", "led2", "j2"],
    gate: "blink",
  },
  {
    id: "bb-sig",
    fig: 2,
    needs: ["j3", "sw1"],
    gate: "running",
  },
  /* ---- Fig. 03 · transistor switch: Control Path + Load Path ----
   * Control: D9 → 1kΩ → Base → Emitter → GND (+ 10k pull-down leg)
   * Load:    12V → Relay coil → Collector → Emitter → GND
   * Flyback: Relay ↔ 1N4007 across the coil (visible only while placed)
   */
  {
    id: "f3-control",
    fig: 3,
    needs: ["rb", "q1"],
    gate: "d9",
  },
  {
    id: "f3-pulldown",
    fig: 3,
    needs: ["rd", "q1"],
    gate: "d9",
  },
  {
    id: "f3-load",
    fig: 3,
    needs: ["p1", "k1", "q1"],
    gate: "d9",
  },
  {
    id: "f3-diode",
    fig: 3,
    needs: ["d1", "k1"],
    gate: "d9",
  },
  /* ---- Fig. 04 · ESP32-S3: 3V3 feed, UART lanes, RGB data ---- */
  {
    id: "f4-power",
    fig: 4,
    needs: ["usb1", "ams", "esp32"],
    gate: "always",
  },
  {
    id: "f4-uart",
    fig: 4,
    needs: ["usb1", "cp2102", "esp32"],
    gate: "running",
  },
  {
    id: "f4-rgb",
    fig: 4,
    needs: ["esp32", "rgb"],
    gate: "running",
  },
  /* ---- Fig. 05 · HC-SR04: ping burst, echo return, echo pull-up ---- */
  {
    id: "f5-ping",
    fig: 5,
    needs: ["h1", "u1", "tx1"],
    gate: "running",
  },
  {
    id: "f5-echo",
    fig: 5,
    needs: ["h1", "u2", "rx1"],
    gate: "running",
  },
  {
    id: "f5-bias",
    fig: 5,
    needs: ["r1", "h1"],
    gate: "always",
  },
];

const WIRES: WRun[] = [
  /* ---- Fig. 01 · Arduino Uno R3 ---- */
  // USB 5V → polyfuse → power-header 5V pin, GND return pin → USB shell
  {
    id: "u-usb-fuse",
    loops: ["uno-vbus"],
    color: RED,
    a: P("usb", { dx: 0.3, y: 0.3 }),
    b: P("fuse", { dx: -0.12, y: 0.28 }),
  },
  {
    id: "u-fuse-5v",
    loops: ["uno-vbus"],
    color: RED,
    a: P("fuse", { dx: 0.14, y: 0.28 }),
    b: Pin(-0.075, -2.4),
  },
  {
    id: "u-gnd-usb",
    loops: ["uno-vbus"],
    color: BLACK,
    a: Pin(0.175, -2.4),
    b: P("usb", { dx: 0.42, y: 0.3 }),
  },
  // D13 header pin → 1k limiter → L LED → header GND
  {
    id: "u-d13-r1",
    loops: ["uno-blink"],
    color: YELLOW,
    a: Pin(-0.275, 2.4),
    b: P("r1", { dx: -0.16, dz: 0.1, y: 0.26 }),
  },
  {
    id: "u-r1-led",
    loops: ["uno-blink"],
    color: YELLOW,
    a: P("r1", { dx: 0.12, y: 0.26 }),
    b: P("ledl", { dx: -0.14, y: 0.24 }),
  },
  {
    id: "u-led-gnd",
    loops: ["uno-blink"],
    color: BLACK,
    a: P("ledl", { dx: 0.14, y: 0.24 }),
    b: Pin(-0.025, 2.4),
  },
  // 5V pin → ON LED → GND pin (rail indicator, lit whenever the bench is powered)
  {
    id: "u-5v-on",
    loops: ["uno-on"],
    color: RED,
    a: Pin(-0.075, -2.4),
    b: P("ledon", { dz: 0.2, y: 0.22 }),
  },
  {
    id: "u-on-gnd",
    loops: ["uno-on"],
    color: BLACK,
    a: P("ledon", { dz: -0.2, y: 0.22 }),
    b: Pin(0.175, -2.4),
  },

  /* ---- Fig. 02 · LED + resistor breadboard lab ---- */
  // +5V rail → red jumper → 220Ω → LED → black jumper → GND rail
  {
    id: "b-rail-j1",
    loops: ["bb-led"],
    color: RED,
    a: Pin(-1.9, 1.5, 0.4),
    b: P("j1", { dx: -0.14, y: 0.32 }),
  },
  {
    id: "b-j1-r1",
    loops: ["bb-led"],
    color: RED,
    a: P("j1", { dx: 0.14, y: 0.32 }),
    b: P("r1", { dx: -0.16, dz: 0.14, y: 0.3 }),
  },
  {
    id: "b-r1-led",
    loops: ["bb-led"],
    color: YELLOW,
    a: P("r1", { dx: 0.16, y: 0.3 }),
    b: P("led2", { dx: -0.16, y: 0.3 }),
  },
  {
    id: "b-led-j2",
    loops: ["bb-led"],
    color: BLACK,
    a: P("led2", { dz: -0.16, y: 0.3 }),
    b: P("j2", { dz: 0.16, y: 0.32 }),
  },
  {
    id: "b-j2-gnd",
    loops: ["bb-led"],
    color: BLACK,
    a: P("j2", { dx: -0.14, y: 0.32 }),
    b: Pin(-1.9, -1.5, 0.4),
  },
  // MCU signal pin → signal jumper → tactile switch leg
  {
    id: "b-pin-j3",
    loops: ["bb-sig"],
    color: YELLOW,
    a: Pin(-2.2, 1.35, 0.4),
    b: P("j3", { dx: -0.16, y: 0.32 }),
  },
  {
    id: "b-j3-sw1",
    loops: ["bb-sig"],
    color: YELLOW,
    a: P("j3", { dx: 0.16, y: 0.32 }),
    b: P("sw1", { dx: -0.14, dz: 0.14, y: 0.3 }),
  },

  /* ---- Fig. 03 · Transistor switch (perfboard GND bus runs along z = −1.75) ---- */
  // CONTROL PATH: D9 (left-edge pin) → 1kΩ base resistor → Q1 base
  {
    id: "f3-d9-rb",
    loops: ["f3-control"],
    color: YELLOW,
    a: Pin(-2.5, 0.9, 0.45),
    b: P("rb", { dx: -0.18, y: 0.3 }),
  },
  {
    id: "f3-rb-base",
    loops: ["f3-control"],
    color: YELLOW,
    a: P("rb", { dx: -0.08, dz: -0.14, y: 0.3 }),
    b: P("q1", { dx: -0.06, dz: 0.16, y: 0.3 }),
  },
  // shared emitter return: Q1 emitter → GND bus (flows for control AND load loops)
  {
    id: "f3-e-gnd",
    loops: ["f3-control", "f3-load"],
    color: BLACK,
    a: P("q1", { dx: 0.06, dz: -0.16, y: 0.3 }),
    b: Pin(-0.85, -1.75, 0.4),
  },
  // 10k pull-down leg: base → R-D → GND bus
  {
    id: "f3-base-rd",
    loops: ["f3-pulldown"],
    color: GREY,
    a: P("q1", { dx: 0.1, dz: 0.16, y: 0.3 }),
    b: P("rd", { dx: -0.14, dz: -0.1, y: 0.3 }),
  },
  {
    id: "f3-rd-gnd",
    loops: ["f3-pulldown"],
    color: GREY,
    a: P("rd", { dx: 0.12, y: 0.3 }),
    b: Pin(0.5, -1.75, 0.4),
  },
  // LOAD PATH: 12V screw terminal → relay coil → Q1 collector (→ emitter → GND, shared run above)
  {
    id: "f3-12v-k1",
    loops: ["f3-load"],
    color: RED,
    a: P("p1", { dx: 0.2, y: 0.4 }),
    b: P("k1", { dx: -0.22, dz: 0.18, y: 0.55 }),
  },
  {
    id: "f3-k1-col",
    loops: ["f3-load"],
    color: ORANGE,
    a: P("k1", { dx: -0.16, dz: -0.18, y: 0.55 }),
    b: P("q1", { dx: 0.12, dz: 0.08, y: 0.3 }),
  },
  // flyback loop: coil terminals across to the 1N4007 (only visible while placed)
  {
    id: "f3-k1-d1",
    loops: ["f3-diode"],
    color: GREY,
    a: P("k1", { dz: -0.24, y: 0.5 }),
    b: P("d1", { dx: 0.14, y: 0.3 }),
  },
  {
    id: "f3-d1-k1",
    loops: ["f3-diode"],
    color: GREY,
    a: P("d1", { dx: -0.14, y: 0.3 }),
    b: P("k1", { dx: 0.24, dz: 0.14, y: 0.55 }),
  },

  /* ---- Fig. 04 · ESP32-S3 DevKit ---- */
  // USB-C COM → AMS1117 → WROOM module → GND header row
  {
    id: "f4-usb-ams",
    loops: ["f4-power"],
    color: RED,
    a: P("usb1", { dx: 0.28, y: 0.2 }),
    b: P("ams", { dx: -0.18, y: 0.2 }),
  },
  {
    id: "f4-ams-esp",
    loops: ["f4-power"],
    color: RED,
    a: P("ams", { dx: 0.16, y: 0.2 }),
    b: P("esp32", { dx: -0.38, dz: 0.12, y: 0.4 }),
  },
  {
    id: "f4-esp-gnd",
    loops: ["f4-power"],
    color: BLACK,
    a: P("esp32", { dx: 0.32, dz: -0.12, y: 0.4 }),
    b: Pin(0.3, -1.1, 0.45),
  },
  // UART: USB-C → CP2102N → module TX/RX
  {
    id: "f4-usb-cp",
    loops: ["f4-uart"],
    color: BLUE,
    a: P("usb1", { dx: 0.2, dz: -0.12, y: 0.2 }),
    b: P("cp2102", { dx: -0.22, y: 0.18 }),
  },
  {
    id: "f4-cp-esp",
    loops: ["f4-uart"],
    color: BLUE,
    a: P("cp2102", { dx: 0.24, y: 0.18 }),
    b: P("esp32", { dx: -0.42, dz: -0.06, y: 0.4 }),
  },
  // WS2812 data daisy-chain leg
  {
    id: "f4-esp-rgb",
    loops: ["f4-rgb"],
    color: GREEN,
    a: P("esp32", { dx: 0.16, dz: -0.22, y: 0.4 }),
    b: P("rgb", { dz: 0.14, y: 0.16 }),
  },

  /* ---- Fig. 05 · HC-SR04 ---- */
  // PING path: header VCC/TRIG → MAX232 driver → T transducer → header GND
  {
    id: "f5-vcc-u1",
    loops: ["f5-ping"],
    color: RED,
    a: Pin(-1.95, 0.375),
    b: P("u1", { dx: -0.36, y: 0.3 }),
  },
  {
    id: "f5-trig-u1",
    loops: ["f5-ping"],
    color: YELLOW,
    a: Pin(-1.95, 0.125),
    b: P("u1", { dx: -0.3, dz: 0.12, y: 0.3 }),
  },
  {
    id: "f5-u1-tx",
    loops: ["f5-ping"],
    color: GREY,
    a: P("u1", { dx: 0.36, y: 0.3 }),
    b: P("tx1", { dx: -0.26, y: 0.4 }),
  },
  {
    id: "f5-tx-gnd",
    loops: ["f5-ping"],
    color: BLACK,
    a: P("tx1", { dz: -0.22, y: 0.4 }),
    b: Pin(-1.95, -0.375),
  },
  // ECHO path: R transducer → LM324 gain stage → header ECHO pin
  {
    id: "f5-rx-u2",
    loops: ["f5-echo"],
    color: GREY,
    a: P("rx1", { dx: -0.26, y: 0.4 }),
    b: P("u2", { dx: 0.36, y: 0.3 }),
  },
  {
    id: "f5-u2-echo",
    loops: ["f5-echo"],
    color: ORANGE,
    a: P("u2", { dx: -0.3, dz: 0.12, y: 0.3 }),
    b: Pin(-1.95, -0.125),
  },
  // pull-up bias: header VCC → 10k → header ECHO
  {
    id: "f5-vcc-r1",
    loops: ["f5-bias"],
    color: RED,
    a: Pin(-1.95, 0.375),
    b: P("r1", { dx: -0.16, y: 0.18 }),
  },
  {
    id: "f5-r1-echo",
    loops: ["f5-bias"],
    color: ORANGE,
    a: P("r1", { dx: 0.12, y: 0.18 }),
    b: Pin(-1.95, -0.125),
  },
];

/* ---------- built geometry ---------- */

interface BuiltRun {
  id: string;
  curve: THREE.QuadraticBezierCurve3;
  color: string;
  loops: string[];
  /** black Dupont end-boots: position + tangent-aligned orientation */
  boots: { pos: THREE.Vector3; quat: THREE.Quaternion }[];
  /** arrow count scales with span */
  arrows: number;
}

/**
 * Directional current arrows: cones gliding source → GND along the wire,
 * apex rotated along curve.getTangentAt(t). Frozen (invisible) the moment
 * the owning loop opens or loses power.
 */
function FlowArrows({
  curve,
  active,
  count,
}: {
  curve: THREE.QuadraticBezierCurve3;
  active: boolean;
  count: number;
}) {
  const grp = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const point = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const g = grp.current;
    if (!g) return;
    if (!active) {
      g.visible = false;
      return;
    }
    g.visible = true;
    phase.current = (phase.current + dt * 0.55) % 1;
    const kids = g.children.length;
    g.children.forEach((c, i) => {
      const t = (phase.current + i / kids) % 1;
      curve.getPointAt(t, point);
      c.position.copy(point);
      curve.getTangentAt(t, tangent);
      if (tangent.lengthSq() > 1e-6)
        c.quaternion.setFromUnitVectors(UP, tangent.normalize());
    });
  });

  return (
    <group ref={grp} visible={false}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i}>
          <coneGeometry args={[0.05, 0.16, 10]} />
          <meshStandardMaterial
            color="#ffcf5c"
            emissive="#ff9d1a"
            emissiveIntensity={1.6}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- overlay ---------- */

export interface CircuitWireOverlayProps {
  spec: BoardSpec;
  placed: Set<string>;
  /** Bench is powered: usb + soldered + fully assembled, no active (non-degraded) fault. */
  powered: boolean;
  /** Sketch state for run/blink-gated loops. */
  running: boolean;
  /** Blink phase (HIGH half-cycle) for pulsed loops. */
  blink: boolean;
  /** Fig. 03: D9 held HIGH with the control/load loop complete — relay closed. */
  d9Energized: boolean;
}

export default function CircuitWireOverlay({
  spec,
  placed,
  powered,
  running,
  blink,
  d9Energized,
}: CircuitWireOverlayProps) {
  const fig = spec.id;
  

  /** part id → board x/z anchor */
  const anchor = useMemo(() => {
    const m = new Map<string, readonly [number, number]>();
    spec.parts.forEach((p) => m.set(p.id, p.p));
    return m;
  }, [spec]);

  const runs = useMemo<BuiltRun[]>(() => {
    const resolve = (n: WNode) => {
      const a = n.part ? anchor.get(n.part) : undefined;
      return new THREE.Vector3(
        (a ? a[0] : 0) + (n.dx ?? 0) + (n.x ?? 0),
        PCB_T + (n.y ?? 0.3),
        (a ? a[1] : 0) + (n.dz ?? 0) + (n.z ?? 0),
      );
    };
    const loopFig = new Map<string, number>(LOOPS.map((l) => [l.id, l.fig]));
    const out: BuiltRun[] = [];
    WIRES.forEach((w) => {
      if (!w.loops.some((id) => loopFig.get(id) === fig)) return;
      const A = resolve(w.a);
      const B = resolve(w.b);
      const dist = A.distanceTo(B);
      // arched jumper: quadratic bezier with a lifted control point
      const mid = A.clone().lerp(B, 0.5);
      mid.y = Math.max(A.y, B.y) + Math.min(0.4 + dist * 0.14, 1.5);
      const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
      const bootQuat = (t: number) => {
        const d = curve.getTangentAt(t).normalize();
        return new THREE.Quaternion().setFromUnitVectors(UP, d);
      };
      out.push({
        id: w.id,
        curve,
        color: w.color,
        loops: w.loops,
        boots: [
          { pos: curve.getPointAt(0), quat: bootQuat(0) },
          { pos: curve.getPointAt(1), quat: bootQuat(1) },
        ],
        arrows: Math.max(1, Math.min(5, Math.round(dist * 1.6))),
      });
    });
    return out;
  }, [fig, anchor]);

  /** per-loop conductivity: closed = all parts placed; live = closed + energized */
  const loopState = useMemo(() => {
    const closed = new Set<string>();
    const live = new Set<string>();
    LOOPS.forEach((l) => {
      if (l.fig !== fig) return;
      if (!l.needs.every((id) => placed.has(id))) return;
      closed.add(l.id);
      const gate =
        l.gate === "d9"
          ? d9Energized
          : l.gate === "blink"
            ? powered && running && blink
            : l.gate === "running"
              ? powered && running
              : powered;
      if (gate) live.add(l.id);
    });
    return { closed, live };
  }, [fig, placed, powered, running, blink, d9Energized]);

  return (
    <group name="circuit-wire-overlay">
      {runs.map((r) => {
        // wires exist only while every part of an owning loop is on the board
        if (!r.loops.some((id) => loopState.closed.has(id))) return null;
        const flowing = r.loops.some((id) => loopState.live.has(id));
        return (
          <group key={`${fig}-${r.id}`}>
            <mesh>
              <tubeGeometry args={[r.curve, 40, WIRE_R, 8, false]} />
              <meshStandardMaterial
                color={r.color}
                roughness={0.55}
                metalness={0.05}
              />
            </mesh>
            {r.boots.map((b, i) => (
              <mesh key={`boot-${i}`} position={b.pos} quaternion={b.quat}>
                <cylinderGeometry args={[BOOT_R, BOOT_R, BOOT_LEN, 10]} />
                <meshStandardMaterial
                  color="#141412"
                  roughness={0.45}
                  metalness={0.1}
                />
              </mesh>
            ))}
            <FlowArrows curve={r.curve} active={flowing} count={r.arrows} />
          </group>
        );
      })}
    </group>
  );
}
