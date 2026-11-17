// Fig07A4988.tsx – Pololu A4988 StepStick (Fig. 07)
// ---------------------------------------------------------------
// 1. Fig07A4988Pcb  – 1.8 × 2.4 (w × d) crimson-red PCB with a 512×512
//    CanvasTexture: routed 45° copper traces, all 16 gold ENIG edge via
//    rings, white component outlines and pinout labels (DIR/STP/SLP/RST/
//    MS3/MS2/MS1/EN left, VMOT/GND/2B/2A/1A/1B/VDD/GND right).
// 2. Fig07A4988Part – realistic multi-part hardware dispatched per part id:
//    A4988 QFN-28 + thermal pad + anodized blue 6-fin heatsink, cross-slotted
//    silver VREF trimpot, dual R100 (0.1Ω) sense resistors, 100µF radial
//    electrolytic cap, 100nF SMD decoupling cap, twin 8-pin male headers.
// 3. No @react-three/drei <Html> / <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import type { Part } from "../../types/simulator";

const PCB_W = 1.8;
const PCB_D = 2.4;
const PCB_T = 0.12;

/** 8-pin header row: standard pitch, centred on the board (z axis). */
const HDR_PITCH = 0.25;
const HDR_X = 0.7;
const hdrZ = (i: number) => -3.5 * HDR_PITCH + i * HDR_PITCH;

/* Canvas mapping: world [x, z] -> texture pixels (top face plane, w × d). */
const px = (x: number) => (x / PCB_W + 0.5) * 512;
const py = (z: number) => (z / PCB_D + 0.5) * 512;

/* ------------------------------------------------------------------ */
/*  Silkscreen / copper texture                                        */
/* ------------------------------------------------------------------ */

function createFig07Texture(mask: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Crimson soldermask
  ctx.fillStyle = mask || "#b31818";
  ctx.fillRect(0, 0, 512, 512);

  // Routed 45° copper traces under the mask
  ctx.strokeStyle = "rgba(255, 198, 198, 0.16)";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const traces: Array<Array<[number, number]>> = [
    // Left header → IC / parts
    [[57, 69], [99, 69], [141, 111]],
    [[57, 123], [113, 123], [141, 151]],
    [[57, 176], [105, 176], [141, 212]],
    [[57, 229], [117, 229], [141, 253]],
    [[57, 283], [99, 283], [141, 325]],
    [[57, 336], [109, 336], [141, 364]],
    [[57, 389], [93, 389], [133, 425]],
    [[57, 443], [101, 443], [141, 403]],
    // Sense resistors → IC
    [[114, 139], [152, 139], [170, 157], [170, 171]],
    [[114, 373], [146, 373], [166, 353], [166, 341]],
    // Right header → parts
    [[455, 69], [393, 69], [343, 119], [255, 119], [197, 119], [183, 105]],
    [[455, 123], [397, 123], [370, 151]],
    [[455, 176], [401, 176], [370, 208]],
    [[455, 229], [395, 229], [370, 255]],
    [[455, 283], [399, 283], [370, 313]],
    [[455, 336], [401, 336], [370, 368]],
    [[455, 389], [421, 389], [395, 415]],
    [[455, 443], [431, 443], [421, 453]],
    // Decorative bottom routes
    [[94, 470], [154, 410], [210, 410]],
    [[370, 480], [430, 420], [470, 420]],
    [[256, 470], [256, 341]],
  ];

  traces.forEach((pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  });

  // Gold ENIG pad helper (annulus + dark drill)
  const drawViaRing = (x: number, y: number, r: number) => {
    ctx.fillStyle = "#d8b85a";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24100e";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };

  // All 16 gold ENIG edge via rings (8 per side)
  const leftX = px(-HDR_X);
  const rightX = px(HDR_X);
  for (let i = 0; i < 8; i++) {
    drawViaRing(leftX, py(hdrZ(i)), 10);
    drawViaRing(rightX, py(hdrZ(i)), 10);
  }

  // Pin-1 square markers
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(leftX - 15, py(hdrZ(0)) - 15, 6, 6);
  ctx.fillRect(rightX - 15, py(hdrZ(0)) - 15, 6, 6);

  // White silkscreen component outlines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;

  // Heatsink / IC outline (exact heatsink footprint 0.8 × 0.8)
  ctx.strokeRect(px(-0.4), py(-0.4), 0.8 * 284.44, 0.8 * 213.33);

  // R100 sense resistor outlines (0.14 × 0.32 footprint)
  ctx.strokeRect(94, py(-0.55) - 34, 40, 68);
  ctx.strokeRect(94, py(0.55) - 34, 40, 68);

  // VREF trimpot outline (r 0.14, world-round → canvas ellipse)
  ctx.beginPath();
  ctx.ellipse(px(0.45), py(0.95), 40, 30, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(0.45), py(0.95), 12, 9, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 100µF radial electrolytic outline (r 0.15)
  ctx.beginPath();
  ctx.ellipse(px(-0.42), py(-0.95), 45, 34, 0, 0, Math.PI * 2);
  ctx.stroke();
  // "+" polarity marks
  ctx.lineWidth = 2;
  const cpx = px(-0.42);
  const cpy = py(-0.95) - 44;
  ctx.beginPath();
  ctx.moveTo(cpx - 8, cpy);
  ctx.lineTo(cpx + 8, cpy);
  ctx.moveTo(cpx, cpy - 8);
  ctx.lineTo(cpx, cpy + 8);
  ctx.stroke();

  // 100nF SMD decoupling cap outline (0.18 × 0.12)
  ctx.lineWidth = 2.5;
  ctx.strokeRect(px(0.5) - 26, py(-0.65) - 17, 51, 34);

  // Header column silks
  ctx.strokeRect(leftX - 19, 50, 38, 412);
  ctx.strokeRect(rightX - 19, 50, 38, 412);

  // Pinout labels (canvas text – used as texture, never drei <Text>)
  const left = ["DIR", "STP", "SLP", "RST", "MS3", "MS2", "MS1", "EN"];
  const right = ["VMOT", "GND", "2B", "2A", "1A", "1B", "VDD", "GND"];
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  left.forEach((lbl, i) => ctx.fillText(lbl, leftX + 24, py(hdrZ(i)) + 4));
  ctx.textAlign = "right";
  right.forEach((lbl, i) => ctx.fillText(lbl, rightX - 24, py(hdrZ(i)) + 4));

  // Reference designators
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("R100", 114, py(-0.55) - 42);
  ctx.fillText("R100", 114, py(0.55) + 52);
  ctx.fillText("100µF", cpx, py(-0.95) + 52);
  ctx.fillText("VREF", px(0.45), py(0.95) - 38);
  ctx.fillText("C104", px(0.5), py(-0.65) - 24);

  // Brand block
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("A4988", 256, py(0.66));
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("STEPSTICK", 256, py(0.78));

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  PCB base                                                           */
/* ------------------------------------------------------------------ */

export function Fig07A4988Pcb({ color }: { color?: string }) {
  const texture = useMemo(() => createFig07Texture(color ?? "#b31818"), [color]);
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
          color={color ?? "#b31818"}
          roughness={0.42}
          metalness={0.08}
        />
      </RoundedBox>
      {/* Silkscreen / copper overlay (exact 1:1 w × d mapping) */}
      <mesh
        position={[0, 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[PCB_W, PCB_D]} />
        <meshStandardMaterial map={texture} roughness={0.38} metalness={0.15} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-part hardware assemblies                                     */
/* ------------------------------------------------------------------ */

const BLUE_ANODIZED = { color: "#1e6fd0", metalness: 0.85, roughness: 0.3 };
const GOLD = { color: "#d4af37", metalness: 0.9, roughness: 0.25 };
const SILVER = { color: "#cfd2d6", metalness: 0.92, roughness: 0.24 };

/** A4988 QFN-28 + exposed thermal pad + 6-fin anodized blue heatsink. */
function A4988IcHeatsink() {
  return (
    <group>
      {/* QFN-28 epoxy body */}
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[0.5, 0.07, 0.5]} />
        <meshStandardMaterial color="#161617" roughness={0.42} metalness={0.1} />
      </mesh>
      {/* Exposed thermal pad on top */}
      <mesh position={[0, 0.086, 0]} castShadow>
        <boxGeometry args={[0.3, 0.014, 0.3]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>
      {/* Heatsink base plate */}
      <mesh position={[0, 0.135, 0]} castShadow>
        <boxGeometry args={[0.8, 0.05, 0.8]} />
        <meshStandardMaterial {...BLUE_ANODIZED} />
      </mesh>
      {/* Six cooling fins */}
      {[-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].map((z) => (
        <mesh key={z} position={[0, 0.29, z]} castShadow>
          <boxGeometry args={[0.76, 0.26, 0.045]} />
          <meshStandardMaterial {...BLUE_ANODIZED} />
        </mesh>
      ))}
    </group>
  );
}

/** Cross-slotted silver VREF current trimpot. */
function VrefPot() {
  return (
    <group>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 20]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.08, 20]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>
      {/* Cross drive slot */}
      <mesh position={[0, 0.102, 0]}>
        <boxGeometry args={[0.21, 0.016, 0.05]} />
        <meshStandardMaterial color="#3a3a3e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.102, 0]}>
        <boxGeometry args={[0.05, 0.016, 0.21]} />
        <meshStandardMaterial color="#3a3a3e" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** R100 (0.1Ω) SMD current-sense resistor, long axis along z. */
function SenseResistor() {
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

/** 100µF radial electrolytic cap (black sleeve, silver top, legs). */
function ElectrolyticCap() {
  return (
    <group>
      {[0.05, -0.05].map((x) => (
        <mesh key={x} position={[x, 0.01, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.02, 8]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.28, 20]} />
        <meshStandardMaterial color="#131313" roughness={0.45} metalness={0.15} />
      </mesh>
      {/* Negative stripe */}
      <mesh position={[0.148, 0.17, 0]}>
        <boxGeometry args={[0.012, 0.22, 0.055]} />
        <meshStandardMaterial color="#c8c8c8" roughness={0.5} />
      </mesh>
      {/* Aluminium can top with vent score */}
      <mesh position={[0, 0.318, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.015, 20]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>
      <mesh position={[0, 0.326, 0]}>
        <boxGeometry args={[0.05, 0.004, 0.3]} />
        <meshStandardMaterial color="#55555a" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** 100nF SMD decoupling cap (MLCC). */
function SmdDecouplingCap() {
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

/** 8-pin male header (gold square pins on black plastic, matches 16 via rings). */
function MaleHeader8() {
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.14, 0.18, 1.9]} />
        <meshStandardMaterial color="#151517" roughness={0.45} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0, 0.36, hdrZ(i)]} castShadow>
          <boxGeometry args={[0.048, 0.32, 0.048]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Part dispatch (per Fig. 07 part id)                                */
/* ------------------------------------------------------------------ */

export const FIG07_PART_IDS = new Set([
  "a4988_ic",
  "vref_pot",
  "rsense1",
  "rsense2",
  "cap_vmot",
  "cap_vdd",
  "hdr_left",
  "hdr_right",
]);

export function isFig07Part(id?: string): boolean {
  return !!id && FIG07_PART_IDS.has(id);
}

export function Fig07A4988Part({ part }: { part: Part; lit?: boolean }) {
  switch (part.id) {
    case "a4988_ic":
      return <A4988IcHeatsink />;
    case "vref_pot":
      return <VrefPot />;
    case "rsense1":
    case "rsense2":
      return <SenseResistor />;
    case "cap_vmot":
      return <ElectrolyticCap />;
    case "cap_vdd":
      return <SmdDecouplingCap />;
    case "hdr_left":
    case "hdr_right":
      return <MaleHeader8 />;
    default:
      return null;
  }
}
