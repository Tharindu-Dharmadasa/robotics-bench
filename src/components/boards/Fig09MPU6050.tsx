// Fig09MPU6050.tsx – GY-521 / MPU-6050 6-Axis IMU Breakout (Fig. 09)
// ---------------------------------------------------------------
// 1. Fig09MPU6050Pcb – 2.6 × 2.0 royal-blue PCB with a 512×512
//    CanvasTexture: routed 45° copper traces, crisp white X/Y/Z
//    coordinate axis arrows, white component outlines, 8 gold header
//    pads and pinout labels (VCC GND SCL SDA XDA XCL AD0 INT).
// 2. Fig09MPU6050Part – realistic hardware dispatched per part id:
//    MPU-6050 QFN-24 MEMS chip with Pin-1 white dot, 662K SOT-23
//    3.3V LDO regulator, dual 4.7kΩ (472) I2C pull-up resistors,
//    2.2nF charge-pump cap, 100nF decoupling cap, green power LED and
//    the 8-pin breakout header — every mesh aligned with the [x, z]
//    coordinates in src/data/boards/fig09.ts.
// 3. No @react-three/drei <Html> / <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import type { Part } from "../../types/simulator";

const PCB_W = 2.6;
const PCB_D = 2.0;
const PCB_T = 0.12;

/** 8-pin header row along x at the front edge of the board. */
const HDR_PITCH = 0.25;
const HDR_N = 8;
const HDR_Z = -0.82;
const hdrX = (i: number) => -((HDR_N - 1) * HDR_PITCH) / 2 + i * HDR_PITCH;

/* Canvas mapping: world [x, z] -> texture pixels (top face plane, w × d). */
const px = (x: number) => (x / PCB_W + 0.5) * 512;
const py = (z: number) => (z / PCB_D + 0.5) * 512;

/* ------------------------------------------------------------------ */
/*  Silkscreen / copper texture                                        */
/* ------------------------------------------------------------------ */

function createFig09Texture(mask: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Royal-blue soldermask
  ctx.fillStyle = mask || "#0f4aa3";
  ctx.fillRect(0, 0, 512, 512);

  // Routed 45° copper traces under the mask
  ctx.strokeStyle = "rgba(190, 215, 255, 0.16)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const traces: Array<Array<[number, number]>> = [
    // Header → IC (I2C + power)
    [
      [-0.875, -0.74], [-0.875, -0.6], [-0.52, -0.27], [-0.52, -0.1], [-0.35, -0.1],
    ],
    [
      [-0.625, -0.74], [-0.625, -0.58], [-0.4, -0.38], [-0.4, -0.27],
    ],
    [
      [-0.375, -0.74], [-0.375, -0.52], [-0.22, -0.38], [-0.22, -0.27],
    ],
    [
      [-0.125, -0.74], [-0.125, -0.48], [-0.06, -0.41], [-0.06, -0.27],
    ],
    [
      [0.125, -0.74], [0.125, -0.45], [0.06, -0.39], [0.06, -0.27],
    ],
    [
      [0.375, -0.74], [0.375, -0.5], [0.22, -0.36], [0.22, -0.27],
    ],
    [
      [0.625, -0.74], [0.625, -0.55], [0.38, -0.31], [0.38, -0.27],
    ],
    [
      [0.875, -0.74], [0.875, -0.6], [0.52, -0.27], [0.52, -0.1], [0.35, -0.1],
    ],
    // SDA / SCL pull-up branch from the bus
    [
      [-0.375, -0.52], [-0.25, -0.42], [-0.25, 0.4], [-0.25, 0.44],
    ],
    [
      [-0.125, -0.48], [0.05, -0.36], [0.05, 0.4], [0.05, 0.44],
    ],
    // LDO 3.3V rail → IC
    [
      [-0.65, 0.34], [-0.65, 0.2], [-0.45, 0.0], [-0.45, -0.1], [-0.35, -0.18],
    ],
    // Charge-pump cap → IC
    [
      [0.65, 0.28], [0.65, 0.1], [0.5, -0.05], [0.4, -0.05], [0.35, -0.1],
    ],
    // VDD bypass cap → IC
    [
      [0.65, -0.28], [0.65, -0.15], [0.42, -0.15],
    ],
    // LED feed
    [
      [-0.75, -0.38], [-0.75, -0.2], [-0.6, -0.05], [-0.45, -0.05], [-0.35, -0.05],
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
    ctx.fillStyle = "#0a1230";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };

  // 8 gold header pads along the front edge
  for (let i = 0; i < HDR_N; i++) {
    drawViaRing(px(hdrX(i)), py(HDR_Z), 11);
  }

  // 4 gold mounting rings in the corners
  ([
    [-1.2, -0.82],
    [1.2, -0.82],
    [-1.2, 0.85],
    [1.2, 0.85],
  ] as Array<[number, number]>).forEach(([x, z]) => drawViaRing(px(x), py(z), 13));

  // Small gold SMD lands under the passives
  ctx.fillStyle = "#d8b85a";
  const land = (x: number, z: number, w: number, h: number) =>
    ctx.fillRect(px(x) - w / 2, py(z) - h / 2, w, h);
  // LDO (3 tabs)
  land(-0.7, 0.62, 16, 20);
  land(-0.6, 0.62, 16, 20);
  land(-0.65, 0.28, 22, 20);
  // Pull-up resistors
  land(-0.34, 0.55, 14, 22);
  land(-0.16, 0.55, 14, 22);
  land(-0.04, 0.55, 14, 22);
  land(0.14, 0.55, 14, 22);
  // Charge-pump + bypass caps
  land(0.56, 0.35, 20, 14);
  land(0.74, 0.35, 20, 14);
  land(0.56, -0.35, 20, 14);
  land(0.74, -0.35, 20, 14);
  // LED
  land(-0.75, -0.38, 16, 12);
  land(-0.75, -0.52, 16, 12);

  // Crisp white coordinate axis arrows (IMU reference frame)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  const ox = px(-1.02);
  const oy = py(0.02);
  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(a - 0.42) * 13, y2 - Math.sin(a - 0.42) * 13);
    ctx.lineTo(x2 - Math.cos(a + 0.42) * 13, y2 - Math.sin(a + 0.42) * 13);
    ctx.closePath();
    ctx.fill();
  };
  arrow(ox, oy, ox + 58, oy); // +X (board long axis)
  arrow(ox, oy, ox, oy - 58); // +Y (board width axis)
  ctx.font = "bold 17px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("+X", ox + 66, oy + 6);
  ctx.fillText("+Y", ox - 8, oy - 70);
  // +Z : out-of-plane symbol (circle with dot)
  ctx.beginPath();
  ctx.arc(ox - 26, oy - 24, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ox - 26, oy - 24, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("+Z (UP)", ox - 46, oy + 26);

  // White silkscreen component outlines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;

  // MPU-6050 QFN-24 outline (0.5 × 0.5 with pin-1 chamfer)
  const icX = px(0.15);
  const icY = py(-0.05);
  ctx.strokeRect(icX - 49, icY - 51, 98, 102);
  ctx.beginPath();
  ctx.arc(icX - 34, icY - 36, 5, 0, Math.PI * 2);
  ctx.stroke();

  // 662K SOT-23 LDO outline
  ctx.strokeRect(px(-0.65) - 17, py(0.45) - 41, 34, 82);
  // 472 pull-up resistor outlines
  ctx.strokeRect(px(-0.25) - 16, py(0.55) - 39, 32, 78);
  ctx.strokeRect(px(0.05) - 16, py(0.55) - 39, 32, 78);
  // Charge-pump + bypass cap outlines
  ctx.strokeRect(px(0.65) - 18, py(0.35) - 16, 36, 32);
  ctx.strokeRect(px(0.65) - 18, py(-0.35) - 16, 36, 32);
  // LED outline with cathode bar
  ctx.strokeRect(px(-0.75) - 14, py(-0.45) - 16, 28, 32);
  ctx.lineWidth = 2;
  ctx.strokeRect(px(-0.75) - 14, py(-0.45) - 16, 4, 32);
  ctx.lineWidth = 2.5;
  // Header strip outline
  ctx.strokeRect(px(hdrX(0)) - 22, py(HDR_Z) - 21, 401, 42);

  // Pinout labels (canvas text – used as texture, never drei <Text>)
  const pinLabels = ["VCC", "GND", "SCL", "SDA", "XDA", "XCL", "AD0", "INT"];
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  pinLabels.forEach((lbl, i) =>
    ctx.fillText(lbl, px(hdrX(i)), py(HDR_Z) + 40),
  );

  // Reference designators + values
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("U1", icX - 46, icY + 66);
  ctx.fillText("MPU-6050", icX - 20, icY - 60);
  ctx.fillText("U2", px(-0.9), py(0.45) - 30);
  ctx.fillText("662K", px(-0.65) - 12, py(0.45) + 54);
  ctx.fillText("R1 4k7", px(-0.25) - 30, py(0.55) + 52);
  ctx.fillText("R2 4k7", px(0.05) - 30, py(0.55) + 52);
  ctx.fillText("C1 2n2", px(0.65) - 30, py(0.35) + 32);
  ctx.fillText("C2 100n", px(0.65) - 30, py(-0.35) - 24);
  ctx.fillText("LED1", px(-0.75) - 22, py(-0.45) + 32);

  // Brand block
  ctx.textAlign = "center";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("GY-521", 256, 478);
  ctx.font = "bold 13px monospace";
  ctx.fillText("MPU-6050 • 6-AXIS • I2C 0x68", 256, 500);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  PCB base                                                           */
/* ------------------------------------------------------------------ */

export function Fig09MPU6050Pcb({ color }: { color?: string }) {
  const texture = useMemo(() => createFig09Texture(color ?? "#0f4aa3"), [color]);
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
          color={color ?? "#0f4aa3"}
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

const GOLD = { color: "#d4af37", metalness: 0.9, roughness: 0.25 };
const SILVER = { color: "#cfd2d6", metalness: 0.92, roughness: 0.24 };
const EPOXY = "#161617";

/** MPU-6050 QFN-24 MEMS sensor: black body, Pin-1 white dot, 24 gold lands. */
function Mpu6050Chip() {
  return (
    <group>
      {/* QFN-24 epoxy body */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.44, 0.075, 0.44]} />
        <meshStandardMaterial color={EPOXY} roughness={0.42} metalness={0.1} />
      </mesh>
      {/* Top laser marking */}
      <mesh position={[0, 0.089, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.28, 0.12]} />
        <meshStandardMaterial color="#3c3c40" roughness={0.6} />
      </mesh>
      {/* Pin-1 white dot */}
      <mesh position={[-0.16, 0.093, -0.16]}>
        <cylinderGeometry args={[0.022, 0.022, 0.006, 12]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.4} />
      </mesh>
      {/* 24 QFN lands: 6 per side */}
      {Array.from({ length: 6 }).map((_, i) => {
        const off = -0.15 + i * 0.06;
        return (
          <group key={i}>
            {[0.235, -0.235].map((x) => (
              <mesh key={`x${x}`} position={[x, 0.012, off]}>
                <boxGeometry args={[0.03, 0.012, 0.045]} />
                <meshStandardMaterial {...GOLD} />
              </mesh>
            ))}
            {[0.235, -0.235].map((z) => (
              <mesh key={`z${z}`} position={[off, 0.012, z]}>
                <boxGeometry args={[0.045, 0.012, 0.03]} />
                <meshStandardMaterial {...GOLD} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** 662K SOT-23 3.3V LDO regulator. */
function Sot23Ldo() {
  return (
    <group>
      <mesh position={[0, 0.062, 0]} castShadow>
        <boxGeometry args={[0.17, 0.085, 0.3]} />
        <meshStandardMaterial color={EPOXY} roughness={0.45} metalness={0.08} />
      </mesh>
      {/* 662K marking */}
      <mesh position={[0, 0.106, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.09, 0.16]} />
        <meshStandardMaterial color="#404044" roughness={0.6} />
      </mesh>
      {/* 3 gull-wing tabs */}
      {[
        [-0.05, 0.17],
        [0.05, 0.17],
        [0, -0.17],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.025, z]} castShadow>
          <boxGeometry args={[0.05, 0.05, 0.07]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
    </group>
  );
}

/** 4.7kΩ (472) SMD pull-up resistor, long axis along z. */
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

/** MLCC SMD capacitor (2.2nF / 100nF), long axis along x. */
function SmdCap() {
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

/** Green SMD power-indicator LED (emits when the board is powered). */
function PowerLed({ color, lit }: { color?: string; lit?: boolean }) {
  const c = color ?? "#3dff6a";
  return (
    <group>
      <mesh position={[0, 0.028, 0]} castShadow>
        <boxGeometry args={[0.09, 0.05, 0.14]} />
        <meshStandardMaterial color="#20242a" roughness={0.4} metalness={0.15} />
      </mesh>
      {/* Emitting die / lens */}
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

/** 8-pin breakout header (gold square pins on black plastic). */
function MaleHeader8() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.95, 0.18, 0.14]} />
        <meshStandardMaterial color="#151517" roughness={0.45} />
      </mesh>
      {Array.from({ length: HDR_N }).map((_, i) => (
        <mesh key={i} position={[hdrX(i), 0.36, 0]} castShadow>
          <boxGeometry args={[0.048, 0.32, 0.048]} />
          <meshStandardMaterial {...GOLD} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Part dispatch (per Fig. 09 part id)                                */
/* ------------------------------------------------------------------ */

export const FIG09_PART_IDS = new Set([
  "mpu_ic",
  "ldo_3v3",
  "r_sda",
  "r_scl",
  "c_cpump",
  "c_vdd",
  "led_imu",
  "hdr_gy521",
]);

export function isFig09Part(id?: string): boolean {
  return !!id && FIG09_PART_IDS.has(id);
}

export function Fig09MPU6050Part({ part, lit }: { part: Part; lit?: boolean }) {
  switch (part.id) {
    case "mpu_ic":
      return <Mpu6050Chip />;
    case "ldo_3v3":
      return <Sot23Ldo />;
    case "r_sda":
    case "r_scl":
      return <SmdResistor />;
    case "c_cpump":
    case "c_vdd":
      return <SmdCap />;
    case "led_imu":
      return <PowerLed color={part.color} lit={!!lit} />;
    case "hdr_gy521":
      return <MaleHeader8 />;
    default:
      // Any other IMU-kind part falls back to the sensor chip assembly.
      return <Mpu6050Chip />;
  }
}
