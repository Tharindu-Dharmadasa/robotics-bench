// Fig13Fusion.tsx – 9-Axis Sensor Fusion: MPU-6050 + HMC5883L (Fig. 13)
// ---------------------------------------------------------------
// 1. Fig13FusionPcb – 3.4 × 2.2 purple carrier PCB with a 512×512
//    CanvasTexture: X / Y / Z alignment crosshairs around the MEMS
//    section, auxiliary XDA/XCL I2C traces bridging the MPU-6050 to
//    the HMC5883L, DRDY/INT status routing into the header, corner
//    brass mounting rings, white component outlines and the VCC / GND
//    / SCL / SDA / XDA / XCL / DRDY / INT pinout labels. The fixed
//    HMC5883L 3-axis magnetometer (top-marked L883) and the dual
//    BSS138 SOT-23 I2C level-shifter MOSFETs live on the carrier.
// 2. Fig13FusionPart – per-part hardware aligned with fig13.ts coords:
//    MPU-6050 6-axis DMP IMU QFN, zero-rate CAL button, 3.3V LDO,
//    4.7kΩ SDA/SCL pull-ups, 100nF VREG + 10nF charge-pump caps, the
//    green fusion-lock LED and the 8-pin GY-511 breakout header.
// 3. No @react-three/drei <Html> / <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Part } from "../../types/simulator";

const PCB_W = 3.4;
const PCB_D = 2.2;
const PCB_T = 0.12;

/** 8-pin breakout header at [0, 0.65], pins run along x. */
const HEADER_N = 8;
const HEADER_PITCH = 0.2;
const headerX = (i: number) =>
  -((HEADER_N - 1) * HEADER_PITCH) / 2 + i * HEADER_PITCH;

/* Canvas mapping: world [x, z] -> texture pixels (top face plane). */
const px = (x: number) => (x / PCB_W + 0.5) * 512;
const py = (z: number) => (z / PCB_D + 0.5) * 512;

const GOLD = { color: "#d4af37", metalness: 0.9, roughness: 0.25 };
const SILVER = { color: "#cfd2d6", metalness: 0.92, roughness: 0.24 };
const EPOXY = "#161617";

/* ------------------------------------------------------------------ */
/*  Bench bus (published from App)                                     */
/* ------------------------------------------------------------------ */

/**
 * Cross-component bench state for Fig. 13, written by App from the live
 * placed set (same lift pattern as ky040Shaft / pca9685Pwm):
 *  • `missing` drives the PCB's pulsing fault-locator rings (amber on the
 *    empty magnetometer pad, red on every other open circuit),
 *  • `magOk` tells the yaw compass whether the HMC5883L still holds the
 *    magnetic heading lock (false → the needle drifts +1.8°/s).
 */
export const fusionBench = {
  missing: new Set<string>(),
  magOk: true,
};

/* ------------------------------------------------------------------ */
/*  Chip top-marking texture                                           */
/* ------------------------------------------------------------------ */

function chipMarkTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#232326";
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = "rgba(244, 244, 240, 0.92)";
  ctx.font = "bold 19px monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, 64, 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Silkscreen / copper texture                                        */
/* ------------------------------------------------------------------ */

function createFig13Texture(mask: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Purple soldermask
  ctx.fillStyle = mask || "#5a2286";
  ctx.fillRect(0, 0, 512, 512);

  // Routed copper traces under the mask
  ctx.strokeStyle = "rgba(216, 200, 255, 0.15)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const traces: Array<Array<[number, number]>> = [
    // Header VCC / GND stubs
    [[-0.7, 0.65], [-0.7, 0.75], [-1.5, 0.75], [-1.5, -0.3]],
    [[-0.5, 0.65], [-0.5, 0.9], [1.4, 0.9]],
    // SDA / SCL from header → pull-ups → MPU-6050
    [[-0.3, 0.65], [-0.3, 0.55], [-0.2, 0.48], [-0.2, 0.34], [-0.05, 0.12], [-0.05, 0.0]],
    [[0.1, 0.65], [0.1, 0.55], [0.25, 0.44], [0.25, 0.32], [0.35, 0.1], [0.35, 0.0]],
    // Pull-up stubs onto the I2C lines
    [[-0.2, 0.52], [-0.3, 0.52]],
    [[0.25, 0.52], [0.1, 0.52]],
    // Auxiliary XDA / XCL bridge: MPU-6050 → HMC5883L
    [[0.35, -0.05], [0.6, -0.05], [0.75, 0.02], [0.98, 0.02]],
    [[0.35, -0.12], [0.62, -0.12], [0.78, -0.06], [0.98, -0.06]],
    // HMC5883L DRDY / INT → header right end
    [[1.32, 0.06], [1.55, 0.06], [1.55, 0.85], [0.7, 0.85], [0.7, 0.65]],
    [[1.32, -0.06], [1.45, -0.1], [1.45, 0.8], [0.5, 0.8], [0.5, 0.65]],
    // 3.3V LDO → rail → header VCC + MPU supply
    [[-0.65, 0.3], [-0.65, -0.3]],
    [[-0.65, -0.3], [-1.5, -0.3]],
    [[-0.5, -0.3], [-0.5, -0.1], [-0.05, -0.1], [0.05, -0.02]],
    // Decoupling caps straddle the rail
    [[-0.65, -0.42], [-0.65, -0.3]],
    [[0.65, -0.42], [0.5, -0.35], [0.15, -0.3]],
    // Lock LED feed
    [[-0.75, -0.08], [-0.75, -0.0], [-0.4, 0.0], [-0.05, -0.02]],
    // Magnetometer GND
    [[1.15, -0.17], [1.15, -0.35], [1.4, -0.35], [1.4, 0.9]],
  ];
  traces.forEach((pts) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) =>
      i === 0 ? ctx.moveTo(px(x), py(z)) : ctx.lineTo(px(x), py(z)),
    );
    ctx.stroke();
  });
  // Thick 3.3V rail
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(px(-1.5), py(-0.3));
  ctx.lineTo(px(0.15), py(-0.3));
  ctx.stroke();
  ctx.lineWidth = 3;

  // Gold ENIG pad helper (annulus + dark drill)
  const drawViaRing = (x: number, y: number, r: number) => {
    ctx.fillStyle = "#d8b85a";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#180a2a";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };

  // Corner brass mounting rings
  ([
    [-1.55, -0.95],
    [1.55, -0.95],
    [-1.55, 0.95],
    [1.55, 0.95],
  ] as Array<[number, number]>).forEach(([x, z]) => drawViaRing(px(x), py(z), 14));

  // 8-pin header pads + white strip
  for (let i = 0; i < HEADER_N; i++) {
    drawViaRing(px(headerX(i)), py(0.65), 9);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px(headerX(0)) - 16, py(0.65) - 16, 149, 32);

  // Pinout labels (VCC, GND, SCL, SDA, XDA, XCL, DRDY, INT)
  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.textAlign = "center";
  ["VCC", "GND", "SCL", "SDA", "XDA", "XCL", "DRDY", "INT"].forEach((lbl, i) => {
    ctx.fillText(lbl, px(headerX(i)), py(0.9));
  });

  // X / Y / Z alignment crosshair around the magnetometer origin
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(px(1.15), py(0), 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px(1.15), py(0), 3, 0, Math.PI * 2);
  ctx.fill();
  // +X arrow
  ctx.beginPath();
  ctx.moveTo(px(1.32), py(0));
  ctx.lineTo(px(1.5), py(0));
  ctx.moveTo(px(1.44), py(-0.045));
  ctx.lineTo(px(1.5), py(0));
  ctx.lineTo(px(1.44), py(0.045));
  ctx.stroke();
  // +Y arrow
  ctx.beginPath();
  ctx.moveTo(px(1.15), py(0.16));
  ctx.lineTo(px(1.15), py(0.5));
  ctx.moveTo(px(1.105), py(0.44));
  ctx.lineTo(px(1.15), py(0.5));
  ctx.lineTo(px(1.195), py(0.44));
  ctx.stroke();
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("+X", px(1.58), py(0) + 4);
  ctx.fillText("+Y", px(1.15), py(0.62) + 4);
  ctx.fillText("+Z", px(0.82), py(0) + 4);

  // White silkscreen component outlines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;

  // MPU-6050 6-axis QFN
  ctx.strokeRect(px(0.15) - 26, py(-0.05) - 26, 52, 52);
  // HMC5883L 3-axis QFN
  ctx.strokeRect(px(1.15) - 21, py(0) - 21, 42, 42);
  // 3.3V LDO (SOT-23)
  ctx.strokeRect(px(-0.65) - 18, py(0.4) - 11, 36, 22);
  // 4.7kΩ pull-ups
  ctx.strokeRect(px(-0.2) - 16, py(0.4) - 9, 32, 18);
  ctx.strokeRect(px(0.25) - 16, py(0.4) - 9, 32, 18);
  // 100nF VREG + 10nF charge-pump caps
  ctx.strokeRect(px(-0.65) - 16, py(-0.5) - 10, 32, 20);
  ctx.strokeRect(px(0.65) - 16, py(-0.5) - 10, 32, 20);
  // 4.7kΩ AUX I2C pull-up
  ctx.strokeRect(px(0.85) - 16, py(-0.35) - 9, 32, 18);
  // CAL button (round footprint)
  ctx.beginPath();
  ctx.arc(px(0.75), py(0.4), 16, 0, Math.PI * 2);
  ctx.stroke();
  // Lock LED
  ctx.strokeRect(px(-0.75) - 12, py(-0.15) - 8, 24, 16);

  // Reference designators
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("U1 MPU-6050", px(0.15) - 24, py(-0.05) + 40);
  ctx.fillText("U2 L883", px(1.15) - 20, py(0) + 34);
  ctx.fillText("Q1 BSS138", px(-1.2) - 30, py(0.25) + 26);
  ctx.fillText("Q2 BSS138", px(-1.2) - 30, py(-0.35) + 26);
  ctx.fillText("IC2 662K", px(-0.65) - 32, py(0.56));
  ctx.fillText("C1 100nF", px(-0.65) - 32, py(-0.34));
  ctx.fillText("C2 10nF", px(0.65) - 28, py(-0.34));
  ctx.fillText("R3 4k7 AUX", px(0.85) - 30, py(-0.19));
  ctx.fillText("R1 4k7", px(-0.2) - 28, py(0.56));
  ctx.fillText("R2 4k7", px(0.25) - 28, py(0.56));
  ctx.textAlign = "center";
  ctx.fillText("CAL", px(0.75), py(0.4) - 22);

  // Brand block along the front edge
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("9-AXIS SENSOR FUSION", px(0), py(-0.95));
  ctx.font = "bold 10px monospace";
  ctx.fillText("MPU-6050 6-DOF DMP + HMC5883L MAG", px(0), py(-0.85));
  ctx.fillText("GY-511 · I2C 0x68 / 0x1E", px(0), py(-0.76));

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  PCB base (incl. fixed HMC5883L + dual BSS138 level shifters)       */
/* ------------------------------------------------------------------ */

/** Generic SOT-23 package (662K-style LDO / BSS138 level shifter). */
function Sot23() {
  return (
    <group>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[0.26, 0.075, 0.15]} />
        <meshStandardMaterial color={EPOXY} roughness={0.45} metalness={0.1} />
      </mesh>
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

/**
 * HMC5883L 3-axis magnetometer QFN-16, laser top-marked "L883" — the
 * 9th axis that magnetically locks the fused yaw estimate.
 */
function Hmc5883lQfn() {
  const mark = useMemo(() => chipMarkTexture("L883"), []);
  useEffect(() => () => mark.dispose(), [mark]);
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.34, 0.06, 0.34]} />
        <meshStandardMaterial color={EPOXY} roughness={0.42} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.072, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 0.1]} />
        <meshStandardMaterial map={mark} roughness={0.6} />
      </mesh>
      {/* Pin-1 dot */}
      <mesh position={[-0.12, 0.074, -0.12]}>
        <cylinderGeometry args={[0.014, 0.014, 0.005, 10]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.4} />
      </mesh>
      {/* 16 QFN pads: 4 per side */}
      {Array.from({ length: 4 }).map((_, i) => {
        const off = -0.105 + i * 0.07;
        return (
          <group key={i}>
            {[-0.18, 0.18].map((z) => (
              <mesh key={z} position={[off, 0.018, z]}>
                <boxGeometry args={[0.045, 0.02, 0.04]} />
                <meshStandardMaterial {...SILVER} />
              </mesh>
            ))}
            {[-0.18, 0.18].map((x) => (
              <mesh key={x} position={[x, 0.018, off]}>
                <boxGeometry args={[0.04, 0.02, 0.045]} />
                <meshStandardMaterial {...SILVER} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export function Fig13FusionPcb({ color }: { color?: string }) {
  const texture = useMemo(() => createFig13Texture(color ?? "#5a2286"), [color]);
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
          color={color ?? "#5a2286"}
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
        [-1.55, -0.95],
        [1.55, -0.95],
        [-1.55, 0.95],
        [1.55, 0.95],
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
      {/* Fixed hardware: HMC5883L magnetometer + dual BSS138 level shifters */}
      <group position={[1.15, 0, 0]}>
        <Hmc5883lQfn />
      </group>
      <group position={[-1.2, 0, 0.25]}>
        <Sot23 />
      </group>
      <group position={[-1.2, 0, -0.35]}>
        <Sot23 />
      </group>
      {/* Open-circuit fault locator rings */}
      <OpenPadRings />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Open-circuit fault locator (pulsing rings on empty pads)           */
/* ------------------------------------------------------------------ */

/** Pad anchor + ring radius per part id (world [x, z]). */
const LOCATOR_PADS: Array<[string, number, number, number, string]> = [
  ["mpu_ic", 0.15, -0.05, 0.28, "#ff2d2d"],
  ["mag_ic", 1.15, 0, 0.24, "#ffb020"], // DEGRADED: amber drift warning
  ["btn_cal", 0.75, 0.4, 0.2, "#ff2d2d"],
  ["ldo_fusion", -0.65, 0.4, 0.2, "#ff2d2d"],
  ["r_sda", -0.2, 0.4, 0.16, "#ff2d2d"],
  ["r_scl", 0.25, 0.4, 0.16, "#ff2d2d"],
  ["r_aux_pull", 0.85, -0.35, 0.16, "#ff2d2d"],
  ["c_vreg", -0.65, -0.5, 0.18, "#ff2d2d"],
  ["c_cp", 0.65, -0.5, 0.18, "#ff2d2d"],
  ["led_lock", -0.75, -0.15, 0.14, "#ff2d2d"],
  ["hdr_8p", 0, 0.65, 0.72, "#ff2d2d"],
];

/**
 * Fault-locator rings: whenever a part is removed its empty PCB pad
 * pulses a locator ring — red for halt-severity open circuits, amber on
 * the magnetometer pad (the DEGRADED magnetic-lock warning). Visibility
 * is driven per-frame from `fusionBench.missing`, no React state churn.
 */
function OpenPadRings() {
  const rings = useRef<Record<string, THREE.Mesh | null>>({});
  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5);
    for (const [id, mesh] of Object.entries(rings.current)) {
      if (!mesh) continue;
      mesh.visible = fusionBench.missing.has(id);
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.8 + pulse * 2.2;
      m.opacity = 0.55 + pulse * 0.4;
    }
  });
  return (
    <group>
      {LOCATOR_PADS.map(([id, x, z, r, color]) => (
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
            emissive={color}
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

/* ------------------------------------------------------------------ */
/*  Multi-part hardware assemblies                                     */
/* ------------------------------------------------------------------ */

/** MPU-6050 6-axis DMP IMU, QFN-24 with laser top marking. */
function Mpu6050Qfn() {
  const mark = useMemo(() => chipMarkTexture("MPU-6050"), []);
  useEffect(() => () => mark.dispose(), [mark]);
  return (
    <group>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[0.4, 0.07, 0.4]} />
        <meshStandardMaterial color={EPOXY} roughness={0.42} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.28, 0.13]} />
        <meshStandardMaterial map={mark} roughness={0.6} />
      </mesh>
      {/* Pin-1 dot */}
      <mesh position={[-0.15, 0.084, -0.15]}>
        <cylinderGeometry args={[0.016, 0.016, 0.005, 10]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.4} />
      </mesh>
      {/* 24 QFN pads: 6 per side */}
      {Array.from({ length: 6 }).map((_, i) => {
        const off = -0.15 + i * 0.06;
        return (
          <group key={i}>
            {[-0.21, 0.21].map((z) => (
              <mesh key={z} position={[off, 0.02, z]}>
                <boxGeometry args={[0.04, 0.02, 0.05]} />
                <meshStandardMaterial {...SILVER} />
              </mesh>
            ))}
            {[-0.21, 0.21].map((x) => (
              <mesh key={x} position={[x, 0.02, off]}>
                <boxGeometry args={[0.05, 0.02, 0.04]} />
                <meshStandardMaterial {...SILVER} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Zero-rate CAL tactile push button (4 silver corner pins). */
function TactButton() {
  return (
    <group>
      {[
        [-0.12, -0.12],
        [0.12, -0.12],
        [-0.12, 0.12],
        [0.12, 0.12],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.02, z]}>
          <boxGeometry args={[0.06, 0.04, 0.06]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
      <mesh position={[0, 0.055, 0]} castShadow>
        <boxGeometry args={[0.3, 0.07, 0.3]} />
        <meshStandardMaterial color="#20222a" roughness={0.45} />
      </mesh>
      {/* Round black actuator cap */}
      <mesh position={[0, 0.115, 0]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 0.07, 18]} />
        <meshStandardMaterial color="#141416" roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.152, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.008, 14]} />
        <meshStandardMaterial color="#2e2e34" roughness={0.5} />
      </mesh>
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

/** 100nF VREG / 10nF charge-pump SMD MLCC capacitor. */
function MlccCap() {
  return (
    <group>
      <mesh position={[0, 0.035, 0]} castShadow>
        <boxGeometry args={[0.2, 0.06, 0.12]} />
        <meshStandardMaterial color="#8b6a4f" roughness={0.55} />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} castShadow>
          <boxGeometry args={[0.05, 0.07, 0.12]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/** Green fusion-lock status LED. */
function SmdLed({ color, lit }: { color?: string; lit?: boolean }) {
  const c = color ?? "#22c55e";
  return (
    <group>
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[0.14, 0.05, 0.09]} />
        <meshStandardMaterial color="#20242a" roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.07, 0.02, 0.06]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={lit ? 1.8 : 0.08}
          roughness={0.3}
        />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]} castShadow>
          <boxGeometry args={[0.05, 0.06, 0.09]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/** 8-pin GY-511 breakout header (VCC GND SCL SDA XDA XCL DRDY INT). */
function Header8() {
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[1.56, 0.16, 0.24]} />
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
/*  Live fusion indicators (I2C activity LED + yaw heading compass)    */
/* ------------------------------------------------------------------ */

/** Mag-locked baseline heading in degrees (matches the telemetry stream). */
const BASE_HEADING = 142.8;

/**
 * MPU-6050 6-axis DMP IMU plus its live fusion indicators: a cyan/green
 * I2C activity LED pulsing with the 400 kHz bus traffic and a floating
 * yaw compass needle locked to the HMC5883L heading. While the
 * magnetometer holds lock the needle relaxes onto the fused heading
 * with a gentle wander; once mag_ic is lifted (fusionBench.magOk false)
 * the LED blinks amber and the needle drifts visibly at +1.8°/s on
 * uncalibrated gyro bias. A halted sketch (lit false) freezes both.
 */
function MpuFusionAssembly({ lit }: { lit: boolean }) {
  const needle = useRef<THREE.Group>(null);
  const ledMat = useRef<THREE.MeshStandardMaterial>(null);
  const heading = useRef(BASE_HEADING);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (needle.current) {
      if (lit && !fusionBench.magOk) {
        heading.current += dt * 1.8; // magnetic lock lost → gyro-bias drift
      } else if (lit) {
        const target = BASE_HEADING + Math.sin(t * 0.5) * 2;
        heading.current += (target - heading.current) * Math.min(1, dt * 3);
      }
      needle.current.rotation.y = -THREE.MathUtils.degToRad(heading.current);
    }
    if (ledMat.current) {
      const magOk = fusionBench.magOk;
      ledMat.current.emissive.set(magOk ? "#22c55e" : "#ffb020");
      ledMat.current.emissiveIntensity = !lit
        ? 0.06
        : magOk
          ? 1.4 + Math.sin(t * 9) * 0.9
          : Math.sin(t * 12) > 0
            ? 2.2
            : 0.15;
    }
  });
  return (
    <group>
      <Mpu6050Qfn />
      {/* I2C bus activity LED (green pulse = locked, amber blink = drift) */}
      <mesh position={[-0.32, 0.05, 0.3]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial
          ref={ledMat}
          color="#0b0e10"
          emissive="#22c55e"
          emissiveIntensity={0.06}
          roughness={0.3}
        />
      </mesh>
      {/* Floating yaw heading compass above the magnetometer pad */}
      <group position={[1.0, 0, 0.05]}>
        <group ref={needle} position={[0, 0.21, 0]}>
          {/* Brass pivot hub */}
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.02, 14]} />
            <meshStandardMaterial {...GOLD} />
          </mesh>
          {/* Needle shaft (spans both sides of the pivot) */}
          <mesh position={[0.03, 0, 0]} castShadow>
            <boxGeometry args={[0.5, 0.014, 0.028]} />
            <meshStandardMaterial {...SILVER} />
          </mesh>
          {/* Red north tip */}
          <mesh position={[0.33, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <coneGeometry args={[0.038, 0.1, 12]} />
            <meshStandardMaterial
              color="#c62828"
              emissive="#ff5a3c"
              emissiveIntensity={0.7}
              roughness={0.35}
            />
          </mesh>
          {/* Grey south tail */}
          <mesh position={[-0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <coneGeometry args={[0.03, 0.08, 12]} />
            <meshStandardMaterial color="#3a3a3e" roughness={0.45} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Part dispatch (per Fig. 13 part id)                                */
/* ------------------------------------------------------------------ */

export const FIG13_PART_IDS = new Set([
  "mpu_ic",
  "mag_ic",
  "btn_cal",
  "ldo_fusion",
  "r_sda",
  "r_scl",
  "r_aux_pull",
  "c_vreg",
  "c_cp",
  "led_lock",
  "hdr_8p",
]);

export function isFig13Part(id?: string): boolean {
  return !!id && FIG13_PART_IDS.has(id);
}

export function Fig13FusionPart({ part, lit }: { part: Part; lit?: boolean }) {
  switch (part.id) {
    case "mpu_ic":
      return <MpuFusionAssembly lit={!!lit} />;
    case "mag_ic":
      return <Hmc5883lQfn />;
    case "btn_cal":
      return <TactButton />;
    case "ldo_fusion":
      return <Sot23 />;
    case "r_sda":
    case "r_scl":
    case "r_aux_pull":
      return <SmdResistor />;
    case "c_vreg":
    case "c_cp":
      return <MlccCap />;
    case "led_lock":
      return <SmdLed color={part.color} lit={!!lit} />;
    case "hdr_8p":
      return <Header8 />;
    default:
      return <MpuFusionAssembly lit={!!lit} />;
  }
}
