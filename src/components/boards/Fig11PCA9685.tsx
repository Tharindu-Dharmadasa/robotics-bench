// Fig11PCA9685.tsx – PCA9685 16-Channel PWM Servo Board (Fig. 11)
// ---------------------------------------------------------------
// 1. Fig11PCA9685Pcb – 6.2 × 2.6 royal-blue PCB with a 512×512
//    CanvasTexture: routed copper traces, A0–A5 I2C address solder
//    pads, channel markings (0–15), a color-coded header guide
//    (PWM / V+ / GND) and corner brass mounting rings.
// 2. Fig11PCA9685Part – realistic hardware dispatched per part id:
//    PCA9685 TSSOP-28 IC, tall 1000µF radial electrolytic bulk cap
//    with scored aluminium vent, reverse-polarity SOT-23 P-MOSFET
//    (fixed on the PCB), green 2-pin V+/GND screw terminal block,
//    color-coded 3-pin servo header banks (Yellow signal, Red V+,
//    Black GND) and the 6-pin I2C input header — every mesh aligned
//    with the [x, z] coordinates in src/data/boards/fig11.ts.
// 3. Sixteen PWM activity LEDs along the CH 0–15 headers (cyan bank for
//    CH 0–7, amber bank for CH 8–15) glow with the live servo angle while
//    the sketch runs, driven from the lab instrument panel.
// 4. No @react-three/drei <Html> / <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Part } from "../../types/simulator";

const PCB_W = 6.2;
const PCB_D = 2.6;
const PCB_T = 0.12;

/** Servo header banks: 8 groups of 3 pins each, per bank. */
const GROUP_PITCH = 0.28;
const PIN_PITCH = 0.1;
const GROUPS_PER_BANK = 8;
const groupX = (g: number) =>
  -((GROUPS_PER_BANK - 1) * GROUP_PITCH) / 2 + g * GROUP_PITCH;

/** 6-pin I2C cascade header on the left edge (rot 90° → runs along z). */
const I2C_PITCH = 0.25;
const I2C_N = 6;
const i2cZ = (i: number) => -((I2C_N - 1) * I2C_PITCH) / 2 + i * I2C_PITCH;

/** Servo header part origins in board coords (the banks sit at these [x, z]). */
const BANK_X = 0.85;
const BANK_Z = 0.65;

/* Canvas mapping: world [x, z] -> texture pixels (top face plane, w × d). */
const px = (x: number) => (x / PCB_W + 0.5) * 512;
const py = (z: number) => (z / PCB_D + 0.5) * 512;

/* ------------------------------------------------------------------ */
/*  Silkscreen / copper texture                                        */
/* ------------------------------------------------------------------ */

function createFig11Texture(mask: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Royal-blue soldermask
  ctx.fillStyle = mask || "#1350a6";
  ctx.fillRect(0, 0, 512, 512);

  // Routed copper traces under the mask
  ctx.strokeStyle = "rgba(190, 215, 255, 0.14)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const traces: Array<Array<[number, number]>> = [
    // I2C header → IC
    [
      [-2.55, -0.05], [-2.2, -0.05], [-1.9, -0.25], [-0.55, -0.25], [-0.4, -0.1],
    ],
    [
      [-2.55, 0.2], [-2.35, 0.2], [-2.1, 0.0], [-1.7, 0.0], [-1.4, 0.25],
      [-0.6, 0.25], [-0.4, 0.1],
    ],
    [
      [-2.55, -0.3], [-2.3, -0.3], [-2.05, -0.45], [-0.7, -0.45], [-0.4, -0.2],
    ],
    // V+ rail: terminal → bulk cap → servo banks (thick)
    [
      [-2.35, 0.45], [-1.85, 0.45], [-1.6, 0.2], [-1.6, -0.4], [-2.0, -0.55],
    ],
    [
      [-1.45, -0.55], [-0.4, -0.55], [-0.1, -0.55], [0.3, -0.55], [0.6, -0.65],
      [1.2, -0.65],
    ],
    [
      [-0.4, 0.55], [-0.1, 0.55], [0.3, 0.55], [0.6, 0.65], [1.2, 0.65],
    ],
    // GND rail
    [
      [-2.35, 0.2], [-2.05, 0.35], [-1.9, 0.8], [-1.0, 0.8], [-0.6, 0.8],
      [-0.3, 0.5],
    ],
    // IC → servo banks (16 channel routes)
    [
      [0.35, -0.1], [0.7, -0.25], [0.7, -0.5], [1.0, -0.55], [1.35, -0.65],
    ],
    [
      [0.35, 0.1], [0.7, 0.25], [0.7, 0.5], [1.0, 0.55], [1.35, 0.65],
    ],
    [
      [0.35, -0.05], [0.85, -0.2], [1.1, -0.45], [1.6, -0.65],
    ],
    [
      [0.35, 0.05], [0.85, 0.2], [1.1, 0.45], [1.6, 0.65],
    ],
    // Oscillator → IC
    [
      [-1.2, 0.45], [-0.75, 0.45], [-0.5, 0.2], [-0.4, 0.15],
    ],
    // LED → IC
    [
      [2.4, 0.8], [2.1, 0.8], [1.9, 0.6], [1.9, 0.2],
    ],
    // Pull-up → IC
    [
      [-0.75, -0.55], [-0.45, -0.55], [-0.3, -0.4], [-0.3, -0.25],
    ],
  ];
  traces.forEach((pts) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) =>
      i === 0 ? ctx.moveTo(px(x), py(z)) : ctx.lineTo(px(x), py(z)),
    );
    ctx.stroke();
  });
  // Thick V+ feed into the banks
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(px(1.2), py(-0.65));
  ctx.lineTo(px(2.0), py(-0.65));
  ctx.moveTo(px(1.2), py(0.65));
  ctx.lineTo(px(2.0), py(0.65));
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
    [-2.95, -1.15],
    [2.95, -1.15],
    [-2.95, 1.15],
    [2.95, 1.15],
  ] as Array<[number, number]>).forEach(([x, z]) => drawViaRing(px(x), py(z), 14));

  // I2C header pads (6, vertical run on the left edge)
  for (let i = 0; i < I2C_N; i++) {
    drawViaRing(px(-2.7), py(i2cZ(i)), 9);
  }
  // I2C header silk strip
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px(-2.7) - 20, py(i2cZ(0)) - 18, 40, 269);

  // A0–A5 I2C address solder pads (pairs of small gold squares)
  ctx.fillStyle = "#d8b85a";
  for (let i = 0; i < 6; i++) {
    const y = py(-0.72 + i * 0.135);
    ctx.fillRect(px(-1.68) - 5, y - 5, 10, 10);
    ctx.fillRect(px(-1.54) - 5, y - 5, 10, 10);
  }
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.textAlign = "left";
  for (let i = 0; i < 6; i++) {
    ctx.fillText(`A${i}`, px(-1.46), py(-0.72 + i * 0.135) + 4);
  }

  // Servo header banks: color-coded guide stripes under the gold pads
  [-0.65, 0.65].forEach((c) => {
    const sgn = Math.sign(c);
    const stripe = (z: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px(-0.3), py(z));
      ctx.lineTo(px(2.0), py(z));
      ctx.stroke();
    };
    stripe(c - 0.22 * sgn, "rgba(230, 194, 41, 0.8)"); // PWM (signal)
    stripe(c, "rgba(198, 40, 40, 0.8)"); // V+
    stripe(c + 0.22 * sgn, "rgba(10, 10, 12, 0.9)"); // GND
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeRect(px(-0.3), py(c) - 17, 2.3 / PCB_W * 512, 34);
  });
  // Gold servo pads: 3 per group, 8 groups per bank
  [-0.65, 0.65].forEach((c) => {
    for (let g = 0; g < GROUPS_PER_BANK; g++) {
      for (let k = 0; k < 3; k++) {
        drawViaRing(
          px(groupX(g) + (k - 1) * PIN_PITCH),
          py(c + (k - 1) * PIN_PITCH),
          6,
        );
      }
    }
  });

  // Channel markings (0–15)
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.textAlign = "center";
  [-0.65, 0.65].forEach((c) => {
    for (let g = 0; g < GROUPS_PER_BANK; g++) {
      const ch = c < 0 ? 8 + g : g;
      ctx.fillText(`${ch}`, px(groupX(g)), py(c) - 34);
    }
  });

  // Color legend (PWM / V+ / GND) at the right end of each bank
  [-0.65, 0.65].forEach((c) => {
    const rows: Array<[string, string, string]> = [
      ["PWM", "rgba(230, 194, 41, 1)", "rgba(230, 194, 41, 0.35)"],
      ["V+", "rgba(211, 47, 47, 1)", "rgba(211, 47, 47, 0.35)"],
      ["GND", "rgba(20, 20, 24, 1)", "rgba(120, 120, 130, 0.5)"],
    ];
    rows.forEach(([lbl, fill, stroke], k) => {
      const y = py(c) + (k - 1) * 17;
      ctx.fillStyle = fill;
      ctx.fillRect(px(2.06), y - 6, 9, 12);
      ctx.strokeStyle = stroke;
      ctx.strokeRect(px(2.06), y - 6, 9, 12);
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(lbl, px(2.02), y + 4);
    });
  });

  // White silkscreen component outlines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;

  // PCA9685 TSSOP-28 outline (0.8 × 0.55)
  ctx.strokeRect(px(0) - 52, py(0) - 54, 104, 108);
  // Crystal outline
  ctx.strokeRect(px(-1.4) - 60, py(0.45) - 26, 120, 52);
  // Bulk electrolytic outline (r 0.35) with "+" polarity
  ctx.beginPath();
  ctx.ellipse(px(-2.1), py(-0.55), 45, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "bold 18px monospace";
  ctx.fillText("+", px(-2.1), py(-0.55) + 6);
  // Screw terminal outline
  ctx.strokeRect(px(-2.5) - 40, py(0.45) - 34, 80, 68);
  // P-MOSFET outline
  ctx.strokeRect(px(-2.05) - 15, py(0.8) - 22, 30, 44);
  // 4.7kΩ pull-up outline
  ctx.strokeRect(px(-0.9) - 16, py(-0.55) - 34, 32, 68);
  // Power LED outline
  ctx.strokeRect(px(2.5) - 12, py(0.8) - 14, 24, 28);

  // Reference designators
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("U1", px(0) - 50, py(0) + 68);
  ctx.fillText("PCA9685", px(0) - 48, py(0) - 62);
  ctx.fillText("Y1 25MHz", px(-1.4) - 58, py(0.45) + 40);
  ctx.fillText("C3 1000µF", px(-2.1) - 30, py(-0.55) + 42);
  ctx.fillText("Q1", px(-2.05) - 12, py(0.8) + 32);
  ctx.fillText("R3 4k7", px(-0.9) - 30, py(-0.55) + 48);
  ctx.fillText("LED1", px(2.5) - 20, py(0.8) + 28);

  // Brand block
  ctx.textAlign = "center";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("PCA9685", px(2.55), py(-0.02));
  ctx.font = "bold 12px monospace";
  ctx.fillText("16-CH 12-BIT PWM", px(2.55), py(0.14));
  ctx.fillText("I2C 0x40", px(2.55), py(0.28));
  ctx.font = "bold 11px monospace";
  ctx.fillText("V+ / GND", px(-2.5), py(0.45) + 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  PCB base (incl. fixed SOT-23 P-MOSFET + brass standoffs)           */
/* ------------------------------------------------------------------ */

/** Reverse-polarity protection SOT-23 P-MOSFET (no dedicated part id). */
function MosfetSot23() {
  return (
    <group position={[-2.05, 0, 0.8]}>
      <mesh position={[0, 0.055, 0]} castShadow>
        <boxGeometry args={[0.15, 0.08, 0.26]} />
        <meshStandardMaterial color="#161617" roughness={0.45} metalness={0.08} />
      </mesh>
      {[
        [-0.045, 0.16],
        [0.045, 0.16],
        [0, -0.16],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.022, z]}>
          <boxGeometry args={[0.045, 0.042, 0.06]} />
          <meshStandardMaterial
            color="#cfd2d6"
            metalness={0.92}
            roughness={0.24}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Fig11PCA9685Pcb({ color }: { color?: string }) {
  const texture = useMemo(() => createFig11Texture(color ?? "#1350a6"), [color]);
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
          color={color ?? "#1350a6"}
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
        [-2.95, -1.15],
        [2.95, -1.15],
        [-2.95, 1.15],
        [2.95, 1.15],
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
      {/* Reverse-polarity P-MOSFET (fixed hardware) */}
      <MosfetSot23 />
      {/* 16 live PWM channel activity LEDs along the CH 0–15 headers */}
      <PwmActivityLeds />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Live PWM channel activity (bench-controlled via pca9685Pwm)        */
/* ------------------------------------------------------------------ */

/**
 * Cross-component bench control for the 16 PWM activity LEDs, written by
 * Viewport3D from App's lab instrument state (same lift pattern as Fig. 10's
 * ky040Shaft): `angle` is the live servo angle (0–180°) mapped to a
 * 1.0–2.0 ms pulse, and `running` gates the channel glow entirely.
 */
export const pca9685Pwm = { angle: 90, running: false };

/** CH 0–7 bank glows cyan, CH 8–15 bank glows amber. */
const PWM_LED_COLORS = ["#22d3ee", "#ffb020"];

/**
 * Sixteen emissive activity LEDs, one per servo channel, mounted outboard
 * of each color-coded header group. Emissive intensity scales with the
 * PCA9685 servo angle (duty ∝ angle) while the sketch runs, with a shimmer
 * walking the channel strobes; idle/dark when the sketch is stopped.
 */
function PwmActivityLeds() {
  const mats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  useFrame(({ clock }) => {
    const duty = 0.15 + (pca9685Pwm.angle / 180) * 0.85; // duty cycle ∝ angle
    const t = clock.elapsedTime;
    mats.current.forEach((m, ch) => {
      if (!m) return;
      const shimmer = pca9685Pwm.running
        ? duty * (1.1 + Math.sin(t * 5 + ch * 0.9) * 0.9)
        : 0.06;
      m.emissiveIntensity = Math.max(0.06, shimmer);
    });
  });
  return (
    <group>
      {[0, 1].map((bank) =>
        Array.from({ length: GROUPS_PER_BANK }).map((_, g) => {
          const ch = bank === 0 ? g : 8 + g; // z = +0.65 bank → CH 0–7
          return (
            <mesh
              key={ch}
              position={[BANK_X + groupX(g), 0.05, bank === 0 ? BANK_Z + 0.32 : -(BANK_Z + 0.32)]}
            >
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial
                ref={(m) => {
                  mats.current[ch] = m;
                }}
                color="#0b0e10"
                emissive={PWM_LED_COLORS[bank]}
                emissiveIntensity={0.06}
              />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-part hardware assemblies                                     */
/* ------------------------------------------------------------------ */

const GOLD = { color: "#d4af37", metalness: 0.9, roughness: 0.25 };
const SILVER = { color: "#cfd2d6", metalness: 0.92, roughness: 0.24 };
const EPOXY = "#161617";

/** PCA9685 TSSOP-28 PWM controller IC (28 pins, Pin-1 dot). */
function Pca9685Ic() {
  return (
    <group>
      {/* TSSOP-28 body */}
      <mesh position={[0, 0.055, 0]} castShadow>
        <boxGeometry args={[0.72, 0.085, 0.46]} />
        <meshStandardMaterial color={EPOXY} roughness={0.42} metalness={0.1} />
      </mesh>
      {/* Top marking */}
      <mesh position={[0, 0.099, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 0.24]} />
        <meshStandardMaterial color="#3c3c40" roughness={0.6} />
      </mesh>
      {/* Pin-1 dot */}
      <mesh position={[-0.28, 0.102, -0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.006, 12]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.4} />
      </mesh>
      {/* 28 gull-wing pins: 14 per side along x */}
      {Array.from({ length: 14 }).map((_, i) => (
        <group key={i}>
          {[-0.26, 0.26].map((z) => (
            <mesh key={z} position={[-0.325 + i * 0.05, 0.025, z]} castShadow>
              <boxGeometry args={[0.03, 0.02, 0.06]} />
              <meshStandardMaterial {...SILVER} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** 25 MHz HC-49 reference crystal (silver oval can). */
function CrystalCan() {
  return (
    <group>
      <mesh
        position={[0, 0.11, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.1, 0.1, 0.46, 18]} />
        <meshStandardMaterial color="#b8bcc2" metalness={0.9} roughness={0.28} />
      </mesh>
      {/* Solder legs */}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.02, 0.06]}>
          <boxGeometry args={[0.03, 0.04, 0.03]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}
    </group>
  );
}

/** Tall 1000µF radial electrolytic bulk cap with scored aluminium vent. */
function BulkCap() {
  return (
    <group>
      {/* Legs */}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.02, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.04, 8]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
      {/* Can */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.92, 22]} />
        <meshStandardMaterial color="#131313" roughness={0.45} metalness={0.15} />
      </mesh>
      {/* Negative stripe */}
      <mesh position={[0.296, 0.52, 0]}>
        <boxGeometry args={[0.014, 0.74, 0.12]} />
        <meshStandardMaterial color="#c8c8c8" roughness={0.5} />
      </mesh>
      {/* Aluminium top with scored vent */}
      <mesh position={[0, 0.988, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 22]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>
      <mesh position={[0, 0.998, 0]}>
        <boxGeometry args={[0.48, 0.004, 0.05]} />
        <meshStandardMaterial color="#55555a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.998, 0]}>
        <boxGeometry args={[0.05, 0.004, 0.48]} />
        <meshStandardMaterial color="#55555a" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Green 2-pin V+ / GND high-current screw terminal block. */
function ScrewTerminalBlock() {
  return (
    <group>
      {/* Green body, 2 cells */}
      <mesh position={[0, 0.19, 0]} castShadow>
        <boxGeometry args={[0.5, 0.34, 0.42]} />
        <meshStandardMaterial color="#1f7a3d" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Cell divider */}
      <mesh position={[0, 0.19, 0]}>
        <boxGeometry args={[0.02, 0.3, 0.43]} />
        <meshStandardMaterial color="#175c2e" roughness={0.55} />
      </mesh>
      {/* Silver screw heads with drive slots */}
      {[-0.125, 0.125].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.375, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.045, 14]} />
            <meshStandardMaterial {...SILVER} />
          </mesh>
          <mesh position={[x, 0.396, 0]}>
            <boxGeometry args={[0.1, 0.008, 0.026]} />
            <meshStandardMaterial color="#3a3a3e" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* Brass wire clamps at the front face */}
      {[-0.125, 0.125].map((x) => (
        <mesh key={x} position={[x, 0.12, -0.21]}>
          <boxGeometry args={[0.09, 0.09, 0.02]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Color-coded 3-pin servo header bank: 8 groups, Yellow signal /
 * Red V+ / Black GND risers under each gold pin.
 */
function ServoBank() {
  const riserColor = ["#e6c229", "#c62828", "#141418"];
  return (
    <group>
      {/* Black plastic bar */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[2.05, 0.16, 0.34]} />
        <meshStandardMaterial color="#151517" roughness={0.45} />
      </mesh>
      {Array.from({ length: GROUPS_PER_BANK }).map((_, g) =>
        [0, 1, 2].map((k) => (
          <group
            key={`${g}-${k}`}
            position={[groupX(g) + (k - 1) * PIN_PITCH, 0, (k - 1) * PIN_PITCH]}
          >
            {/* Color-coded riser */}
            <mesh position={[0, 0.055, 0]}>
              <boxGeometry args={[0.055, 0.09, 0.055]} />
              <meshStandardMaterial color={riserColor[k]} roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[0.042, 0.3, 0.042]} />
              <meshStandardMaterial {...GOLD} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

/** 6-pin I2C cascade header (rot 90° → runs along z). */
function I2cHeader6() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.14, 0.16, 1.4]} />
        <meshStandardMaterial color="#151517" roughness={0.45} />
      </mesh>
      {Array.from({ length: I2C_N }).map((_, i) => (
        <mesh key={i} position={[0, 0.36, i2cZ(i)]} castShadow>
          <boxGeometry args={[0.048, 0.32, 0.048]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}
    </group>
  );
}

/** 4.7kΩ SMD I2C pull-up resistor. */
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

/** Green power-indicator LED. */
function PowerLed({ color, lit }: { color?: string; lit?: boolean }) {
  const c = color ?? "#22c55e";
  return (
    <group>
      <mesh position={[0, 0.028, 0]} castShadow>
        <boxGeometry args={[0.09, 0.05, 0.14]} />
        <meshStandardMaterial color="#20242a" roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.058, 0]}>
        <boxGeometry args={[0.06, 0.02, 0.09]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={lit ? 1.8 : 0.08}
          roughness={0.3}
        />
      </mesh>
      {[-0.08, 0.08].map((z) => (
        <mesh key={z} position={[0, 0.03, z]} castShadow>
          <boxGeometry args={[0.09, 0.06, 0.03]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Part dispatch (per Fig. 11 part id)                                */
/* ------------------------------------------------------------------ */

export const FIG11_PART_IDS = new Set([
  "pca_ic",
  "x_osc",
  "c_bulk",
  "term_pwr",
  "hdr_i2c",
  "hdr_servos_lo",
  "hdr_servos_hi",
  "r_i2c",
  "led_pwr",
]);

export function isFig11Part(id?: string): boolean {
  return !!id && FIG11_PART_IDS.has(id);
}

export function Fig11PCA9685Part({ part, lit }: { part: Part; lit?: boolean }) {
  switch (part.id) {
    case "pca_ic":
      return <Pca9685Ic />;
    case "x_osc":
      return <CrystalCan />;
    case "c_bulk":
      return <BulkCap />;
    case "term_pwr":
      return <ScrewTerminalBlock />;
    case "hdr_i2c":
      return <I2cHeader6 />;
    case "hdr_servos_lo":
    case "hdr_servos_hi":
      return <ServoBank />;
    case "r_i2c":
      return <SmdResistor />;
    case "led_pwr":
      return <PowerLed color={part.color} lit={!!lit} />;
    default:
      // Any other QFP-kind part falls back to the PWM controller IC.
      return <Pca9685Ic />;
  }
}
