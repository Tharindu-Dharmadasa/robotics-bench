import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PCB_T } from "../data/boards";
import type { BoardSpec } from "../types/simulator";

/**
 * CircuitWireOverlay — non-breaking 3D jumper-wire layer, restricted STRICTLY
 * to Fig. 02 (LED + resistor breadboard) and Fig. 03 (transistor switch).
 *
 * Renders arched jumper wires (TubeGeometry with black Dupont end-boots)
 * between exact pin-to-component board coordinates, and glides directional
 * arrow cones along each wire (rotated along curve.getTangentAt(t)) whenever
 * that specific loop is electrically closed and energized. On Fig. 02 each
 * coloured cable is owned by exactly one jumper part, so removing that wire in
 * the Parts checklist hides its cable instantly and opens the loop.
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

/** Breadboard socket plane: top face of the 0.16-thick board. */
const SOCKET_Y = PCB_T / 2; // 0.08

/* ---------- Fig. 02 · three flush-seated jumper wires ----------
 * Every endpoint is an exact socket coordinate on the bench plane (y = 0.08):
 * the docked blue header's 5V/GND sockets and the breadboard tie-points around
 * the switch, resistor and LED. No wire end floats above empty space.
 */
const FIG2_TUBE_R = 0.024;
const FIG2_BOOT_R = 0.038;
const FIG2_BOOT_LEN = 0.11;

interface Fig2Run {
  id: string;
  /** jumper part that owns this cable — visibility follows placed.has(part) */
  part: string;
  loops: string[];
  color: string;
  /** ordered socket waypoints; each consecutive pair becomes one low arch */
  via: WNode[];
}

const FIG2_WIRES: Fig2Run[] = [
  // Red: docked 5V socket → tactile-switch input hole
  {
    id: "b2-5v-switch",
    part: "j1", // Jumper wire (5V)
    loops: ["bb-led"],
    color: "#dc2626",
    via: [
      { x: -2.35, z: -0.55, y: SOCKET_Y }, // docked 5V
      { x: -1.18, z: -0.72, y: SOCKET_Y }, // switch input
    ],
  },
  // Amber: switch output hole → 220Ω left hole
  {
    id: "b2-switch-res",
    part: "j3", // Jumper wire (signal)
    loops: ["bb-sig"],
    color: "#f59e0b",
    via: [
      { x: -0.88, z: -0.38, y: SOCKET_Y }, // switch output
      { x: -0.62, z: -0.38, y: SOCKET_Y }, // 220Ω left
    ],
  },
  // Black: LED cathode hole → docked GND, routed along the front/bottom margin
  // (z ≈ -1.62) and up past the header so it never crosses the components.
  {
    id: "b2-led-gnd",
    part: "j2", // Jumper wire (GND)
    loops: ["bb-led"],
    color: "#18181b",
    via: [
      { x: 0.78, z: -0.38, y: SOCKET_Y }, // LED cathode
      { x: 0.78, z: -1.62, y: SOCKET_Y }, // drop to the front margin
      { x: -2.5, z: -1.62, y: SOCKET_Y }, // run along the front margin
      { x: -2.5, z: 0.55, y: SOCKET_Y }, // up past the docked header
      { x: -2.35, z: 0.55, y: SOCKET_Y }, // docked GND
    ],
  },
];

/** Low arch between two socket points; both ends stay on the board plane. */
const fig2Hop = (A: THREE.Vector3, B: THREE.Vector3) => {
  const mid = A.clone().lerp(B, 0.5);
  mid.y = SOCKET_Y + Math.min(0.36, Math.max(0.16, A.distanceTo(B) * 0.14));
  return new THREE.QuadraticBezierCurve3(A, mid, B);
};

/** Build the three Fig. 02 jumpers as one chained low-arch path per wire. */
function buildFig2Runs(): BuiltRun[] {
  return FIG2_WIRES.map((w) => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    let span = 0;
    const at = (n: WNode) =>
      new THREE.Vector3(n.x ?? 0, n.y ?? SOCKET_Y, n.z ?? 0);
    for (let i = 0; i < w.via.length - 1; i++) {
      const A = at(w.via[i]);
      const B = at(w.via[i + 1]);
      span += A.distanceTo(B);
      path.add(fig2Hop(A, B));
    }
    const bootAt = (t: number, away: number) => {
      const d = path.getTangentAt(t).normalize();
      const pos = path
        .getPointAt(t)
        .addScaledVector(d, away * FIG2_BOOT_LEN * 0.5);
      return { pos, quat: new THREE.Quaternion().setFromUnitVectors(UP, d) };
    };
    return {
      id: w.id,
      part: w.part,
      curve: path,
      color: w.color,
      loops: w.loops,
      r: FIG2_TUBE_R,
      bootR: FIG2_BOOT_R,
      bootLen: FIG2_BOOT_LEN,
      // lift each boot along the wire so it seats on the socket, not through it
      boots: [bootAt(0, 1), bootAt(1, -1)],
      arrows: Math.max(1, Math.min(4, Math.round(span * 0.9))),
    };
  });
}

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
   * Control: D9 → 1kΩ → Base → Emitter → GND
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

  /* ---- Fig. 02 · see FIG2_WIRES / buildFig2Runs above ---- */

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

/* ---------- Fig. 03 · four clean, low-profile jumper wires ----------
 * Coordinates come straight from fig03.ts parts (q1 −0.9,0.35 · rb 0.45,1.1 ·
 * rd 0.45,0.2 · d1 1.5,−0.55 · k1 1.9,0.75 · p1 −2.05,−1.25). Each wire hops
 * at 0.24–0.32 bench units and is routed AROUND the parts — never over the
 * 2N2222 (q1) or the 1N4007 (d1).
 */

const FIG3_TUBE_R = 0.022;
const FIG3_BOOT_R = 0.045;
const FIG3_BOOT_LEN = 0.14;

interface Fig3Run {
  id: string;
  loops: string[];
  color: string;
  /** ordered waypoints: each consecutive pair becomes one low arch */
  via: WNode[];
}

const FIG3_WIRES: Fig3Run[] = [
  // W1 · amber CONTROL: D9 input pin → 1kΩ base resistor → 2N2222 base
  {
    id: "f3-w1-control",
    loops: ["f3-control"],
    color: "#f59e0b",
    via: [
      Pin(-2.5, 0.9, 0.45), // D9 digital pin, left bench edge
      P("rb", { dx: -0.18, y: 0.32 }), // 1kΩ base-resistor lead
      P("q1", { dx: -0.06, dz: 0.16, y: 0.3 }), // 2N2222 base lead
    ],
  },
  // W2 · red 12V LOAD: screw terminal → relay coil → 2N2222 collector,
  // detouring through a waypoint south of the 10k pull-down (rd) so the
  // arch never grazes it
  {
    id: "f3-w2-load",
    loops: ["f3-load"],
    color: "#dc2626",
    via: [
      P("p1", { dx: 0.2, y: 0.4 }), // 12V screw terminal
      Pin(0.45, -0.85, 0.45), // detour waypoint south of rd
      P("k1", { dx: -0.22, dz: 0.18, y: 0.55 }), // relay coil terminal
      P("q1", { dx: 0.12, dz: 0.08, y: 0.3 }), // 2N2222 collector lead
    ],
  },
  // W3 · green FLYBACK clamp: relay coil ↔ 1N4007 (only while D1 is placed)
  {
    id: "f3-w3-flyback",
    loops: ["f3-diode"],
    color: "#16a34a",
    via: [
      P("k1", { dz: -0.24, y: 0.5 }), // relay coil terminal
      P("d1", { dx: 0.14, y: 0.3 }), // 1N4007 lead
    ],
  },
  // W4 · black COMMON GND: 2N2222 emitter → GND bus (z = −1.75); shared by
  // the control and load loops, so it flows whenever either one is live
  {
    id: "f3-w4-gnd",
    loops: ["f3-control", "f3-load"],
    color: "#18181b",
    via: [
      P("q1", { dx: 0.06, dz: -0.16, y: 0.3 }), // 2N2222 emitter lead
      Pin(-0.85, -1.75, 0.4), // perfboard GND bus
    ],
  },
];

/** One low hop (0.24–0.32 bench units) between two waypoints. */
const fig3Hop = (A: THREE.Vector3, B: THREE.Vector3) => {
  const mid = A.clone().lerp(B, 0.5);
  mid.y =
    Math.max(A.y, B.y) +
    Math.min(0.32, Math.max(0.24, A.distanceTo(B) * 0.5));
  return new THREE.QuadraticBezierCurve3(A, mid, B);
};

/** Build the four Fig. 03 jumpers as one chained low-arch path per wire. */
function buildFig3Runs(resolve: (n: WNode) => THREE.Vector3): BuiltRun[] {
  return FIG3_WIRES.map((w) => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    let span = 0;
    for (let i = 0; i < w.via.length - 1; i++) {
      const A = resolve(w.via[i]);
      const B = resolve(w.via[i + 1]);
      span += A.distanceTo(B);
      path.add(fig3Hop(A, B));
    }
    const bootQuat = (t: number) => {
      const d = path.getTangentAt(t).normalize();
      return new THREE.Quaternion().setFromUnitVectors(UP, d);
    };
    return {
      id: w.id,
      curve: path,
      color: w.color,
      loops: w.loops,
      r: FIG3_TUBE_R,
      bootR: FIG3_BOOT_R,
      bootLen: FIG3_BOOT_LEN,
      boots: [
        { pos: path.getPointAt(0), quat: bootQuat(0) },
        { pos: path.getPointAt(1), quat: bootQuat(1) },
      ],
      arrows: Math.max(1, Math.min(3, Math.round(span * 0.8))),
    };
  });
}

/* ---------- built geometry ---------- */

interface BuiltRun {
  id: string;
  /** Fig. 02: owning jumper part id — cable visible only while that part is placed */
  part?: string;
  curve: THREE.Curve<THREE.Vector3>;
  color: string;
  loops: string[];
  /** tube radius (bench units) — Fig. 03 runs are slimmer (0.022) */
  r: number;
  /** Dupont end-boot cross-section / length */
  bootR: number;
  bootLen: number;
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
  curve: THREE.Curve<THREE.Vector3>;
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
        <mesh key={i} scale={0.055}>
          <coneGeometry args={[1, 2.5, 10]} />
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

/**
 * Strict lab gate: 3D arched jumper wires exist ONLY on Fig. 02 (LED +
 * resistor breadboard lab) and Fig. 03 (transistor switch lab). Every other
 * board — Fig. 01, Fig. 04, Fig. 05 and Figs. 06–13 — renders zero wires.
 */
export default function CircuitWireOverlay(props: CircuitWireOverlayProps) {
  const board = props.spec.id - 1; // zero-based bench board index
  if (board !== 1 && board !== 2) return null;
  return <BreadboardWireOverlay {...props} board={board} />;
}

function BreadboardWireOverlay({
  board,
  spec,
  placed,
  powered,
  running,
  blink,
  d9Energized,
}: CircuitWireOverlayProps & { board: number }) {
  const fig = board + 1; // zero-based board index → 1-based fig number

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
    // Fig. 02: three flush-seated jumpers on exact sockets (see FIG2_WIRES)
    if (fig === 2) return buildFig2Runs();
    // Fig. 03: four tidy low-profile jumpers (see FIG3_WIRES)
    if (fig === 3) return buildFig3Runs(resolve);
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
        r: WIRE_R,
        bootR: BOOT_R,
        bootLen: BOOT_LEN,
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
        // Fig. 02: each coloured cable belongs to one jumper wire part — pull
        // that part from the checklist and its cable disappears immediately.
        if (fig === 2) {
          if (!r.part || !placed.has(r.part)) return null;
        } else if (!r.loops.some((id) => loopState.closed.has(id))) {
          // other figs: wires exist only while every part of a loop is placed
          return null;
        }
        const flowing = r.loops.some((id) => loopState.live.has(id));
        return (
          <group key={`${fig}-${r.id}`}>
            <mesh>
              <tubeGeometry args={[r.curve, 48, r.r, 8, false]} />
              <meshStandardMaterial
                color={r.color}
                roughness={0.55}
                metalness={0.05}
              />
            </mesh>
            {r.boots.map((b, i) => (
              <mesh key={`boot-${i}`} position={b.pos} quaternion={b.quat}>
                <cylinderGeometry args={[r.bootR, r.bootR, r.bootLen, 10]} />
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
