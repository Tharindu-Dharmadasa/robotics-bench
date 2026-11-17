// Fig10Encoder.tsx – KY-040 Incremental Rotary Encoder (Fig. 10)
// ---------------------------------------------------------------
// 1. Fig10EncoderPcb – 3.1 × 1.9 matte-black PCB with a 512×512
//    CanvasTexture: white silkscreen outlines, gold mounting rings,
//    5 gold header pads and pinout labels (CLK DT SW + GND).
// 2. Fig10EncoderPart – realistic hardware dispatched per part id:
//    metallic EC11 switch housing, threaded silver hex nut collar and
//    a rotating D-cut aluminium shaft (bench-driven: eases to the live
//    detent count from the lab instrument panel, π/10 rad per step, and
//    depresses axially while SW is held — with erratic chatter-jitter if
//    the 100nF debounce caps are removed), dual 10kΩ (103) pull-up
//    resistors, dual 100nF debounce capacitors, tactile push switch and
//    5-pin right-angle header —
//    all aligned with the [x, z] coordinates in src/data/boards/fig10.ts.
// 3. No @react-three/drei <Html> / <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Part } from "../../types/simulator";

const PCB_W = 1.9;
const PCB_D = 3.1;
const PCB_T = 0.12;

/** 5-pin interface header along the front edge. */
const HDR_PITCH = 0.25;
const HDR_N = 5;
const HDR_Z = 1.25;
const hdrX = (i: number) => -((HDR_N - 1) * HDR_PITCH) / 2 + i * HDR_PITCH;

/* Canvas mapping: world [x, z] -> texture pixels (top face plane, w × d). */
const px = (x: number) => (x / PCB_W + 0.5) * 512;
const py = (z: number) => (z / PCB_D + 0.5) * 512;

/* ------------------------------------------------------------------ */
/*  Cross-component chatter state                                      */
/* ------------------------------------------------------------------ */

/**
 * Cross-component presence flag for the 100nF CLK/DT debounce caps
 * (registered on mount, cleared on unmount). The EC11 mechanism reads
 * it in useFrame: with both RC filters present the shaft rotates
 * smoothly; with one or both missing the contact chatter makes the
 * rotation count jump erratically.
 */
export const ky040Debounce = { caps: new Set<string>() };

/**
 * Cross-component bench control for the EC11 shaft, written by Viewport3D
 * from App's lab instrument state (same lift pattern as ky040Debounce):
 * `step` is the live detent count — one detent = π/10 rad of shaft rotation,
 * so the D-flat index marker walks one marker-width per click — and
 * `pressed` is the axial SW push that sinks the shaft into the housing.
 */
export const ky040Shaft = { step: 0, pressed: false };

/* ------------------------------------------------------------------ */
/*  Silkscreen / copper texture                                        */
/* ------------------------------------------------------------------ */

function createFig10Texture(mask: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Matte-black soldermask
  ctx.fillStyle = mask || "#18181a";
  ctx.fillRect(0, 0, 512, 512);

  // Routed traces (pale silver on black PCB)
  ctx.strokeStyle = "rgba(200, 205, 215, 0.1)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const traces: Array<Array<[number, number]>> = [
    // Encoder → header
    [
      [-0.15, 0.1], [-0.15, 0.55], [-0.5, 0.9], [-0.5, 1.16],
    ],
    [
      [0, 0.1], [0, 0.42], [0, 0.9], [0, 1.16],
    ],
    [
      [0.15, 0.1], [0.15, 0.55], [0.5, 0.9], [0.5, 1.16],
    ],
    // Encoder → pull-ups / RC filters
    [
      [-0.25, 0.08], [-0.35, 0.18], [-0.7, 0.18], [-0.7, 0.5],
    ],
    [
      [0.25, 0.08], [0.35, 0.18], [0.25, 0.28], [0.25, 0.5],
    ],
    // Pull-up → cap nets
    [
      [-0.7, 0.8], [-0.7, 0.95], [-0.45, 0.95], [-0.25, 0.78],
    ],
    [
      [0.25, 0.8], [0.45, 1.0], [0.7, 1.0], [0.7, 0.78],
    ],
    // Switch → header
    [
      [0.15, 0.42], [0.3, 0.57], [0.3, 0.9], [0.25, 0.95], [0.25, 1.16],
    ],
  ];
  traces.forEach((pts) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) =>
      i === 0 ? ctx.moveTo(px(x), py(z)) : ctx.lineTo(px(x), py(z)),
    );
    ctx.stroke();
  });

  // Gold ENIG pad helper (annulus + dark drill)
  const drawViaRing = (x: number, y: number, r: number) => {
    ctx.fillStyle = "#d8b85a";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101012";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };

  // 5 gold header pads along the front edge
  for (let i = 0; i < HDR_N; i++) {
    drawViaRing(px(hdrX(i)), py(HDR_Z), 11);
  }

  // Gold EC11 mounting rings (threaded bushing tabs, left + right)
  drawViaRing(px(-0.55), py(-0.2), 15);
  drawViaRing(px(0.55), py(-0.2), 15);

  // White silkscreen outlines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;

  // EC11 encoder body outline + bushing circle + D-cut flat indicator
  const ex = px(0);
  const ey = py(-0.2);
  ctx.beginPath();
  ctx.ellipse(ex, ey, 89, 55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(ex, ey, 51, 31, 0, 0, Math.PI * 2);
  ctx.stroke();
  // D-flat chord mark on the right of the bushing
  ctx.beginPath();
  ctx.moveTo(ex + 40, ey - 27);
  ctx.lineTo(ex + 40, ey + 27);
  ctx.stroke();

  // Tactile push switch outline
  ctx.strokeRect(px(0) - 46, py(0.25) - 28, 92, 56);

  // 10kΩ pull-up resistor outlines
  ctx.strokeRect(px(-0.7) - 20, py(0.65) - 23, 40, 46);
  ctx.strokeRect(px(-0.25) - 20, py(0.65) - 23, 40, 46);
  // 100nF debounce cap outlines
  ctx.strokeRect(px(0.25) - 23, py(0.65) - 9, 46, 18);
  ctx.strokeRect(px(0.7) - 23, py(0.65) - 9, 46, 18);
  // Header strip outline
  ctx.strokeRect(px(hdrX(0)) - 18, py(HDR_Z) - 17, 354, 34);

  // Pinout labels (canvas text – used as texture, never drei <Text>)
  const pinLabels = ["CLK", "DT", "SW", "+", "GND"];
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  pinLabels.forEach((lbl, i) =>
    ctx.fillText(lbl, px(hdrX(i)), py(HDR_Z) + 32),
  );

  // Reference designators
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("R1 10k", px(-0.7) - 20, py(0.65) - 30);
  ctx.fillText("R2 10k", px(-0.25) - 20, py(0.65) - 30);
  ctx.fillText("C1 100n", px(0.25) - 23, py(0.65) - 16);
  ctx.fillText("C2 100n", px(0.7) - 23, py(0.65) - 16);
  ctx.textAlign = "center";
  ctx.fillText("SW1", px(0), py(0.25) + 42);

  // Brand block
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("KY-040", 256, 58);
  ctx.font = "bold 13px monospace";
  ctx.fillText("ROTARY ENCODER • EC11 QUADRATURE", 256, 84);
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("EC11", ex, ey + 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  PCB base                                                           */
/* ------------------------------------------------------------------ */

export function Fig10EncoderPcb({ color }: { color?: string }) {
  const texture = useMemo(() => createFig10Texture(color ?? "#18181a"), [color]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group>
      <RoundedBox
        args={[PCB_W, PCB_T, PCB_D]}
        radius={0.05}
        smoothness={3}
        position={[0, -PCB_T / 2, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={color ?? "#18181a"}
          roughness={0.55}
          metalness={0.06}
        />
      </RoundedBox>
      {/* Silkscreen / copper overlay (exact 1:1 w × d mapping) */}
      <mesh
        position={[0, 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[PCB_W, PCB_D]} />
        <meshStandardMaterial map={texture} roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-part hardware assemblies                                     */
/* ------------------------------------------------------------------ */

const GOLD = { color: "#d4af37", metalness: 0.9, roughness: 0.25 };
const SILVER = { color: "#cfd2d6", metalness: 0.92, roughness: 0.24 };
const STEEL = { color: "#3a3d42", metalness: 0.85, roughness: 0.38 };

/** 10kΩ (103) SMD pull-up resistor, long axis along z. */
function SmdResistor() {
  return (
    <group>
      <mesh position={[0, 0.038, 0]} castShadow>
        <boxGeometry args={[0.13, 0.055, 0.26]} />
        <meshStandardMaterial color="#ded9c6" roughness={0.55} />
      </mesh>
      {[-0.145, 0.145].map((z) => (
        <mesh key={z} position={[0, 0.04, z]} castShadow>
          <boxGeometry args={[0.13, 0.06, 0.05]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * 100nF RC debounce capacitor. Registers itself with ky040Debounce so
 * the EC11 mechanism can detect when the chatter filter is missing.
 */
function DebounceCap({ id }: { id: string }) {
  useEffect(() => {
    ky040Debounce.caps.add(id);
    return () => {
      ky040Debounce.caps.delete(id);
    };
  }, [id]);
  return (
    <group>
      <mesh position={[0, 0.032, 0]} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.1]} />
        <meshStandardMaterial color="#b08d5e" roughness={0.55} />
      </mesh>
      {[-0.075, 0.075].map((x) => (
        <mesh key={x} position={[x, 0.034, 0]} castShadow>
          <boxGeometry args={[0.03, 0.055, 0.1]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/** Rest height of the rotating shaft group above the PCB. */
const SHAFT_REST_Y = 0.78;

/** EC11 mechanical quadrature encoder with rotating D-cut shaft. */
function EncoderMechanism() {
  const shaftRef = useRef<THREE.Group>(null);
  const state = useRef({ angle: 0, y: SHAFT_REST_Y });

  useFrame((s, dt) => {
    const t = s.clock.getElapsedTime();
    const st = state.current;
    // 0 tracked caps → generic rendering, assume nominal filter; 2 → OK.
    const tracked = ky040Debounce.caps.size;
    const capsOk = tracked === 0 || tracked >= 2;

    // Bench-driven mechanism: the D-shaft eases toward the live detent count
    // (π/10 per step) and sinks ~2 mm into the housing while SW is held.
    // With the 100nF RC filters missing, contact chatter wobbles every
    // moving detent instead of landing clean on the index mark.
    const target = ky040Shaft.step * (Math.PI / 10);
    const moving = Math.abs(target - st.angle) > 0.005;
    const chatter =
      !capsOk && moving
        ? Math.sin(t * 47) * 0.07 + Math.sin(t * 113) * 0.045
        : 0;
    const k = 1 - Math.exp(-dt * 14);
    st.angle = THREE.MathUtils.lerp(st.angle, target + chatter, k);

    if (shaftRef.current) {
      shaftRef.current.rotation.y = st.angle;
      st.y = THREE.MathUtils.lerp(
        st.y,
        ky040Shaft.pressed ? SHAFT_REST_Y - 0.07 : SHAFT_REST_Y,
        k,
      );
      shaftRef.current.position.y = st.y;
    }
  });

  return (
    <group>
      {/* Metal EC11 housing (two tiers) */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.54, 0.32, 0.54]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.4, 0.24, 0.4]} />
        <meshStandardMaterial color="#45484e" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* Washer flange + threaded silver hex nut collar */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.03, 24]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.12, 6]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>

      {/* Rotating D-cut aluminium shaft */}
      <group ref={shaftRef} position={[0, 0.78, 0]}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.56, 20]} />
          <meshStandardMaterial
            color="#b9bdc3"
            metalness={0.9}
            roughness={0.28}
          />
        </mesh>
        {/* D flat facet */}
        <mesh position={[0.066, 0.28, 0]} castShadow>
          <boxGeometry args={[0.018, 0.56, 0.11]} />
          <meshStandardMaterial
            color="#aeb2b8"
            metalness={0.9}
            roughness={0.3}
          />
        </mesh>
        {/* Rotation index marker */}
        <mesh position={[0, 0.565, 0]}>
          <boxGeometry args={[0.02, 0.006, 0.12]} />
          <meshStandardMaterial color="#222" roughness={0.5} />
        </mesh>
      </group>

      {/* Mounting tabs with the gold ring holes */}
      {[-0.445, 0.445].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]} castShadow>
          <boxGeometry args={[0.35, 0.08, 0.24]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}

      {/* 5 solder pins toward the header side */}
      {[-0.2, -0.1, 0, 0.1, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.03, 0.3]}>
          <boxGeometry args={[0.03, 0.06, 0.03]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}
    </group>
  );
}

/** Tactile push switch (axial push-to-click on the D-shaft circuit). */
function TactileSwitch() {
  const legs: Array<[number, number]> = [
    [-0.13, -0.13],
    [0.13, -0.13],
    [-0.13, 0.13],
    [0.13, 0.13],
  ];
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.32, 0.1, 0.32]} />
        <meshStandardMaterial color="#101012" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.105, 0]} castShadow>
        <boxGeometry args={[0.26, 0.015, 0.26]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.09, 16]} />
        <meshStandardMaterial color="#1b1b1e" roughness={0.45} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.02, z]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/** 5-pin right-angle male header (pins exit horizontally, inboard). */
function RightAngleHeader5() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[1.4, 0.14, 0.14]} />
        <meshStandardMaterial color="#151517" roughness={0.45} />
      </mesh>
      {Array.from({ length: HDR_N }).map((_, i) => (
        <group key={i} position={[hdrX(i), 0, 0]}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[0.048, 0.1, 0.048]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
          <mesh position={[0, 0.024, -0.08]} castShadow>
            <boxGeometry args={[0.048, 0.048, 0.24]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Part dispatch (per Fig. 10 part id)                                */
/* ------------------------------------------------------------------ */

export const FIG10_PART_IDS = new Set([
  "enc_sw",
  "r_clk",
  "r_dt",
  "c_clk",
  "c_dt",
  "sw_push",
  "hdr_5p",
]);

export function isFig10Part(id?: string): boolean {
  return !!id && FIG10_PART_IDS.has(id);
}

export function Fig10EncoderPart({ part }: { part: Part; lit?: boolean }) {
  switch (part.id) {
    case "enc_sw":
      return <EncoderMechanism />;
    case "r_clk":
    case "r_dt":
      return <SmdResistor />;
    case "c_clk":
      return <DebounceCap id="c_clk" />;
    case "c_dt":
      return <DebounceCap id="c_dt" />;
    case "sw_push":
      return <TactileSwitch />;
    case "hdr_5p":
      return <RightAngleHeader5 />;
    default:
      // Any other encoder-kind part falls back to the EC11 mechanism.
      return <EncoderMechanism />;
  }
}
