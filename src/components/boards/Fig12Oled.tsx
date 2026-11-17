// Fig12Oled.tsx – SSD1306 0.96" 128×64 I2C OLED Display Module (Fig. 12)
// ---------------------------------------------------------------
// 1. Fig12OledPcb – 2.8 × 2.8 royal-blue carrier PCB with a 512×512
//    CanvasTexture: routed copper traces from the 4-pin header into the
//    boost circuit, corner brass mounting rings, white component
//    outlines (662K 3.3V LDO, 1µF charge-pump flying caps, 4.7kΩ I2C
//    pull-ups, chip-on-glass SSD1306 driver) and the GND / VCC / SCL /
//    SDA pinout labels. The fixed 662K SOT-23 LDO completes the SMD
//    boost circuit on the carrier itself.
// 2. Fig12OledPart – per-part hardware aligned with fig12.ts coords:
//    the elevated glossy black 128×64 glass bezel (y = 0.28) on brass
//    standoffs, connected to the carrier via a copper polyimide flex
//    ribbon, plus the 1µF charge-pump flying cap, 4.7µF VCC filter
//    cap, twin 4.7kΩ I2C pull-ups and the 4-pin header. The glass is
//    lifted high enough that the SMD boost circuit underneath stays
//    visible and clickable.
// 3. When lit is true the screen renders a live CanvasTexture in
//    useFrame: crisp cyan (#38bdf8) telemetry text ("ROBOTICS BENCH //
//    I2C 0x3C") over a scrolling sine + bar waveform. Removing the
//    1µF charge-pump capacitors trips the fault rule (sketch halts →
//    lit false) and the glass falls completely pitch-black.
// 4. No @react-three/drei <Html> / <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Part } from "../../types/simulator";

const PCB_W = 2.8;
const PCB_D = 2.8;
const PCB_T = 0.12;

/** 4-pin header (GND/VCC/SCL/SDA) at [0, -1.15], pins run along x. */
const HEADER_N = 4;
const HEADER_PITCH = 0.25;
const headerX = (i: number) =>
  -((HEADER_N - 1) * HEADER_PITCH) / 2 + i * HEADER_PITCH;

/* Canvas mapping: world [x, z] -> texture pixels (top face plane). */
const px = (x: number) => (x / PCB_W + 0.5) * 512;
const py = (z: number) => (z / PCB_D + 0.5) * 512;

const GOLD = { color: "#d4af37", metalness: 0.9, roughness: 0.25 };
const SILVER = { color: "#cfd2d6", metalness: 0.92, roughness: 0.24 };

/* ------------------------------------------------------------------ */
/*  Bench bus (published from App)                                     */
/* ------------------------------------------------------------------ */

/**
 * Cross-component bench state for Fig. 12, written by App from the live
 * placed set (same lift pattern as ky040Shaft / pca9685Pwm). The PCB's
 * open-circuit fault locator reads `missing` every frame to pulse red
 * rings on the empty pads of removed parts (LDO, charge-pump caps,
 * pull-ups, header …).
 */
export const oledBench = { missing: new Set<string>() };

/* ------------------------------------------------------------------ */
/*  Silkscreen / copper texture                                        */
/* ------------------------------------------------------------------ */

function createFig12Texture(mask: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Royal-blue soldermask
  ctx.fillStyle = mask || "#124ea4";
  ctx.fillRect(0, 0, 512, 512);

  // Routed copper traces under the mask
  ctx.strokeStyle = "rgba(190, 215, 255, 0.14)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const traces: Array<Array<[number, number]>> = [
    // Header pins up into the distribution rails
    [[-0.375, -1.15], [-0.375, -0.8], [-0.5, -0.75]],
    [[-0.125, -1.15], [-0.125, -0.75]],
    [[0.125, -1.15], [0.125, -0.75]],
    [[0.375, -1.15], [0.375, -0.8], [0.5, -0.75]],
    // VCC rail across the SMD row
    [[-1.15, -0.75], [1.15, -0.75]],
    // Rail → 662K 3.3V LDO → boost output to the glass
    [[-1.15, -0.75], [-1.15, -0.32]],
    [[-1.15, -0.08], [-1.15, 0.35], [-0.7, 0.5], [-0.45, 0.5], [-0.3, 0.4]],
    // Pull-ups hang off SCL / SDA
    [[-0.35, -0.75], [-0.35, -0.6]],
    [[0.35, -0.75], [0.35, -0.6]],
    // SDA / SCL into the flex connector fingers
    [[-0.35, -0.6], [-0.35, -0.42], [-0.3, -0.3]],
    [[0.35, -0.6], [0.35, -0.42], [0.3, -0.3]],
    // Charge-pump / VCC filter caps straddle the rail
    [[-0.9, -0.75], [-0.9, -0.55], [-0.8, -0.4], [-0.5, -0.32]],
    [[0.9, -0.75], [0.9, -0.55], [0.8, -0.4], [0.5, -0.32]],
    // SDA series protection resistor stubs
    [[-0.15, -0.6], [-0.05, -0.6]],
    [[0.05, -0.6], [0.15, -0.6]],
  ];
  traces.forEach((pts) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) =>
      i === 0 ? ctx.moveTo(px(x), py(z)) : ctx.lineTo(px(x), py(z)),
    );
    ctx.stroke();
  });
  // Thick rails
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(px(-1.15), py(-0.75));
  ctx.lineTo(px(1.15), py(-0.75));
  ctx.stroke();
  ctx.lineWidth = 3;

  // Gold ENIG pad helper (annulus + dark drill)
  const drawViaRing = (x: number, y: number, r: number) => {
    ctx.fillStyle = "#d8b85a";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a1230";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };

  // Corner brass mounting rings
  ([
    [-1.05, -1.05],
    [1.05, -1.05],
    [-1.05, 1.05],
    [1.05, 1.05],
  ] as Array<[number, number]>).forEach(([x, z]) => drawViaRing(px(x), py(z), 14));

  // 4-pin header pads + white strip
  for (let i = 0; i < HEADER_N; i++) {
    drawViaRing(px(headerX(i)), py(-1.15), 9);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px(headerX(0)) - 18, py(-1.15) - 16, 189, 32);

  // Pinout labels (GND, VCC, SCL, SDA)
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.textAlign = "center";
  ["GND", "VCC", "SCL", "SDA"].forEach((lbl, i) => {
    ctx.fillText(lbl, px(headerX(i)), py(-1.29));
  });

  // Copper polyimide flex-ribbon connector: 10 gold fingers at z ≈ -0.3
  ctx.fillStyle = "#d8b85a";
  for (let i = 0; i < 10; i++) {
    const x = -0.45 + i * 0.1;
    ctx.fillRect(px(x) - 3, py(-0.3) - 7, 6, 14);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeRect(px(-0.5) - 6, py(-0.3) - 12, 108, 24);

  // White silkscreen component outlines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;

  // 662K 3.3V LDO (SOT-23)
  ctx.strokeRect(px(-1.15) - 18, py(-0.2) - 11, 36, 22);
  // 1µF charge-pump flying cap
  ctx.strokeRect(px(-0.9) - 16, py(-0.6) - 10, 32, 20);
  // 4.7µF VCC filter cap
  ctx.strokeRect(px(0.9) - 20, py(-0.6) - 11, 40, 22);
  // 4.7kΩ pull-up / series protection resistors
  ctx.strokeRect(px(-0.35) - 16, py(-0.6) - 9, 32, 18);
  ctx.strokeRect(px(0) - 16, py(-0.6) - 9, 32, 18);
  ctx.strokeRect(px(0.35) - 16, py(-0.6) - 9, 32, 18);
  // Chip-on-glass SSD1306 driver (etched under the lifted glass)
  ctx.strokeRect(px(0) - 40, py(0.3) - 22, 80, 44);

  // Reference designators
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("IC1 662K", px(-1.15) - 34, py(-0.05));
  ctx.fillText("C1 1µF", px(-0.9) - 30, py(-0.44));
  ctx.fillText("C2 4.7µF", px(0.9) - 36, py(-0.42));
  ctx.fillText("R1 4k7", px(-0.35) - 30, py(-0.44));
  ctx.fillText("R3 4k7", px(0) - 30, py(-0.4));
  ctx.fillText("R2 4k7", px(0.35) - 30, py(-0.44));

  // Brand block between the header and the SMD row
  ctx.textAlign = "center";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("SSD1306 0.96\" OLED", px(0), py(-0.98));
  ctx.font = "bold 11px monospace";
  ctx.fillText("128×64 · I2C 0x3C", px(0), py(-0.9));

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  PCB base (incl. fixed 662K LDO + brass standoffs)                  */
/* ------------------------------------------------------------------ */

/** 662K 3.3V LDO (SOT-23) — the clickable `ldo_oled` boost-circuit part. */
function Sot23Ldo() {
  return (
    <group>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[0.26, 0.075, 0.15]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Laser-etched top marking */}
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.13, 0.07]} />
        <meshStandardMaterial color="#3a3a3e" roughness={0.6} />
      </mesh>
      {[
        [0.1, 0.05],
        [0.1, -0.05],
        [-0.1, 0],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.02, z]}>
          <boxGeometry args={[0.055, 0.04, 0.05]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Open-circuit fault locator (pulsing rings on empty pads)           */
/* ------------------------------------------------------------------ */

/** Pad anchor + ring radius per part id (world [x, z]). */
const LOCATOR_PADS: Array<[string, number, number, number]> = [
  ["oled_glass", 0, 0.2, 0.55],
  ["cap_cpump1", -0.9, -0.6, 0.2],
  ["c_vcc", 0.9, -0.6, 0.22],
  ["ldo_oled", -1.15, -0.2, 0.2],
  ["r_i2c_oled", 0, -0.6, 0.18],
  ["r_sda", -0.35, -0.6, 0.18],
  ["r_scl", 0.35, -0.6, 0.18],
  ["hdr_i2c", 0, -1.15, 0.42],
];

/**
 * Fault-locator rings: whenever a part is removed, a red ring pulses
 * (≈2.5 Hz heartbeat) on its empty PCB pad so the open circuit can be
 * spotted from any angle. Visibility is driven per-frame from
 * `oledBench.missing` — no React state churn.
 */
function OpenPadRings() {
  const rings = useRef<Record<string, THREE.Mesh | null>>({});
  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5);
    for (const [id, mesh] of Object.entries(rings.current)) {
      if (!mesh) continue;
      mesh.visible = oledBench.missing.has(id);
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.8 + pulse * 2.2;
      m.opacity = 0.55 + pulse * 0.4;
    }
  });
  return (
    <group>
      {LOCATOR_PADS.map(([id, x, z, r]) => (
        <mesh
          key={id}
          ref={(m) => {
            rings.current[id] = m;
          }}
          position={[x, 0.014, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <torusGeometry args={[r, 0.022, 10, 40]} />
          <meshStandardMaterial
            color="#4a0d0d"
            emissive="#ff2d2d"
            emissiveIntensity={1.5}
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Fig12OledPcb({ color }: { color?: string }) {
  const texture = useMemo(() => createFig12Texture(color ?? "#124ea4"), [color]);
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
          color={color ?? "#124ea4"}
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
      {/* Corner brass mounting rings / standoffs */}
      {[
        [-1.05, -1.05],
        [1.05, -1.05],
        [-1.05, 1.05],
        [1.05, 1.05],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.06, z]}>
          <cylinderGeometry args={[0.16, 0.16, 0.13, 16]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.88}
            roughness={0.25}
          />
        </mesh>
      ))}
      {/* SMD boost circuit: clickable 662K LDO lives at its own part pad */}
      <OpenPadRings />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Live OLED screen (lit → dynamic CanvasTexture, else pitch black)   */
/* ------------------------------------------------------------------ */

/**
 * 128×64 emissive glass. When lit, the 256×128 canvas is redrawn every
 * frame in useFrame with crisp cyan (#38bdf8) telemetry text over a
 * scrolling sine + bar waveform. When the 1µF charge-pump flying
 * capacitors are removed the fault halts the sketch (lit → false) and
 * the screen renders as completely pitch-black glossy glass.
 */
function OledScreen({ lit }: { lit: boolean }) {
  const { canvas, ctx, tex } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const cx = c.getContext("2d")!;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, ctx: cx, tex: t };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(({ clock }) => {
    if (!lit) return;
    const t = clock.elapsedTime;

    ctx.fillStyle = "#000208";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#38bdf8";

    // Telemetry header
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "left";
    ctx.fillText("ROBOTICS BENCH // I2C 0x3C", 5, 15);
    ctx.fillRect(5, 20, 246, 1);

    // Scrolling sine trace
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= canvas.width; i++) {
      const y =
        56 +
        Math.sin((i / canvas.width) * Math.PI * 6 + t * 4) * 15;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // Scrolling bar spectrum
    for (let b = 0; b < 20; b++) {
      const h = 6 + (Math.sin(t * 5 + b * 0.6) * 0.5 + 0.5) * 28;
      ctx.fillRect(6 + b * 12.4, 122 - h, 8, h);
    }

    // Frame-rate readout
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "right";
    ctx.fillText("60FPS", 251, 34);

    tex.needsUpdate = true;
  });

  // Not lit (sketch halted, e.g. charge-pump caps removed) → pitch black.
  if (!lit) {
    return (
      <mesh position={[0, 0.356, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.42, 0.71]} />
        <meshStandardMaterial color="#020204" roughness={0.08} metalness={0.1} />
      </mesh>
    );
  }

  return (
    <mesh position={[0, 0.356, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.42, 0.71]} />
      <meshStandardMaterial
        map={tex}
        emissive="#ffffff"
        emissiveMap={tex}
        emissiveIntensity={1.5}
        color="#000000"
        roughness={0.15}
        metalness={0}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-part hardware assemblies                                     */
/* ------------------------------------------------------------------ */

/** Elevated glossy black 128×64 glass bezel + flex ribbon (oled_glass). */
function OledGlassAssembly({ lit }: { lit: boolean }) {
  return (
    <group>
      {/* Brass standoff posts lifting the glass to y = 0.28 */}
      {[
        [-0.72, -0.42],
        [0.72, -0.42],
        [-0.72, 0.42],
        [0.72, 0.42],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.105, z]}>
          <cylinderGeometry args={[0.035, 0.035, 0.21, 12]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}

      {/* Copper polyimide flex ribbon: glass underside → carrier pads */}
      <mesh position={[0, 0.11, -0.525]} rotation={[-0.246, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.21, 0.012]} />
        <meshStandardMaterial
          color="#b87333"
          metalness={0.85}
          roughness={0.35}
        />
      </mesh>
      {/* Gold flex fingers landing on the carrier connector (world z = -0.3) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-0.25 + i * 0.1, 0.006, -0.5]}>
          <boxGeometry args={[0.06, 0.005, 0.05]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}

      {/* Glossy black glass bezel, elevated to y = 0.28 */}
      <RoundedBox
        args={[1.7, 0.14, 1.1]}
        radius={0.03}
        smoothness={3}
        position={[0, 0.28, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#050506"
          roughness={0.15}
          metalness={0.25}
        />
      </RoundedBox>

      {/* 128×64 emissive screen (2:1 active area) */}
      <OledScreen lit={lit} />
    </group>
  );
}

/** 1µF / 4.7µF SMD MLCC capacitor (charge-pump flying + VCC filter). */
function MlccCap({ big }: { big?: boolean }) {
  const l = big ? 0.3 : 0.2;
  const h = big ? 0.08 : 0.06;
  const w = big ? 0.16 : 0.12;
  return (
    <group>
      <mesh position={[0, h / 2 + 0.005, 0]} castShadow>
        <boxGeometry args={[l, h, w]} />
        <meshStandardMaterial color="#8b6a4f" roughness={0.55} />
      </mesh>
      {[-(l / 2 - 0.03), l / 2 - 0.03].map((x, i) => (
        <mesh key={i} position={[x, h / 2 + 0.005, 0]} castShadow>
          <boxGeometry args={[0.06, h + 0.01, w]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/** 4.7kΩ SMD I2C pull-up resistor. */
function SmdResistor() {
  return (
    <group>
      <mesh position={[0, 0.033, 0]} castShadow>
        <boxGeometry args={[0.26, 0.055, 0.13]} />
        <meshStandardMaterial color="#ded9c6" roughness={0.55} />
      </mesh>
      {[-0.145, 0.145].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} castShadow>
          <boxGeometry args={[0.05, 0.06, 0.13]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/** 4-pin male header (GND / VCC / SCL / SDA). */
function Header4() {
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.9, 0.16, 0.24]} />
        <meshStandardMaterial color="#151517" roughness={0.45} />
      </mesh>
      {Array.from({ length: HEADER_N }).map((_, i) => (
        <mesh key={i} position={[headerX(i), 0.25, 0]} castShadow>
          <boxGeometry args={[0.05, 0.32, 0.05]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Part dispatch (per Fig. 12 part id)                                */
/* ------------------------------------------------------------------ */

export const FIG12_PART_IDS = new Set([
  "oled_glass",
  "cap_cpump1",
  "c_vcc",
  "ldo_oled",
  "r_i2c_oled",
  "r_sda",
  "r_scl",
  "hdr_i2c",
]);

export function isFig12Part(id?: string): boolean {
  return !!id && FIG12_PART_IDS.has(id);
}

export function Fig12OledPart({
  part,
  lit,
  charred,
}: {
  part: Part;
  lit?: boolean;
  /** Stage-2 burnout: a scorched glass can never be emissive again. */
  charred?: boolean;
}) {
  switch (part.id) {
    case "oled_glass":
      return <OledGlassAssembly lit={!!lit && !charred} />;
    case "cap_cpump1":
      return <MlccCap />;
    case "c_vcc":
      return <MlccCap big />;
    case "ldo_oled":
      return <Sot23Ldo />;
    case "r_i2c_oled":
    case "r_sda":
    case "r_scl":
      return <SmdResistor />;
    case "hdr_i2c":
      return <Header4 />;
    default:
      return <OledGlassAssembly lit={!!lit && !charred} />;
  }
}
