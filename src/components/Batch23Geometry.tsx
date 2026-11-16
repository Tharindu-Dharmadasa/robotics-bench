// Batch23Geometry.tsx – Industrial PBR Realism (Figs. 06‑13)
// ---------------------------------------------------------------
// This file implements:
//   1. createBoardSilkscreenTexture(style, baseColor) – generates a 512×512
//      THREE.CanvasTexture containing etched copper trace lines, ENIG gold
//      solder pads, white component placement boxes and realistic pin‑out labels for
//      all eight board styles.
//   2. Realistic multi‑part meshes for motorDriver (L298N), stepperDriver (A4988),
//      servo (SG90), oled (SSD1306), screw terminals and jumpers.
//   3. Exported symbols exactly matching what PartGeometry.tsx expects:
//      BATCH23_KINDS, BATCH23_STYLES, Batch23PartGeo, Batch23PcbBase.
//   4. No use of @react-three/drei <Html> or <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import type { Part } from "../types/simulator";

import { Fig06L298NPcb, Fig06L298NPart } from "./boards/Fig06L298N";

/* ------------------------------------------------------------------ */
/*  Constants & Type Guards                                            */
/* ------------------------------------------------------------------ */

export const BATCH23_KINDS = [
  "motorDriver",
  "stepperDriver",
  "servo",
  "imu",
  "encoder",
  "oled",
  "diode",
  "screw",
  "jumper",
] as const;

export type Batch23Kind = (typeof BATCH23_KINDS)[number];

export function isBatch23Kind(kind?: string): boolean {
  return (
    typeof kind === "string" && BATCH23_KINDS.includes(kind as Batch23Kind)
  );
}

export const BATCH23_STYLES = [
  "l298n-red",
  "stepstick",
  "sg90-cutaway",
  "breakout-blue",
  "ky040-dark",
  "pca9685-blue",
  "oled-module",
  "fusion-purple",
] as const;

export type Batch23Style = (typeof BATCH23_STYLES)[number];

export function resolveBatch23Style(nameOrStyle?: string): Batch23Style | null {
  if (!nameOrStyle) return null;
  if (BATCH23_STYLES.includes(nameOrStyle as Batch23Style)) {
    return nameOrStyle as Batch23Style;
  }
  const s = nameOrStyle.toLowerCase();
  if (s.includes("l298n")) return "l298n-red";
  if (s.includes("a4988") || s.includes("stepstick")) return "stepstick";
  if (
    s.includes("sg90") ||
    (s.includes("servo") && !s.includes("pca") && !s.includes("16"))
  ) {
    return "sg90-cutaway";
  }
  if (s.includes("fusion") || s.includes("purple")) return "fusion-purple";
  if (s.includes("mpu") || s.includes("imu") || s.includes("gy-521"))
    return "breakout-blue";
  if (s.includes("encoder") || s.includes("ky040") || s.includes("rotary"))
    return "ky040-dark";
  if (s.includes("pca9685") || s.includes("pca") || s.includes("16 pwm"))
    return "pca9685-blue";
  if (s.includes("oled") || s.includes("ssd1306")) return "oled-module";
  return null;
}

export function isBatch23Style(nameOrStyle?: string): boolean {
  return resolveBatch23Style(nameOrStyle) !== null;
}

export const BATCH23_STYLE_DIMS: Record<Batch23Style, [number, number]> = {
  "l298n-red": [4.4, 4.4],
  stepstick: [1.7, 2.2],
  "sg90-cutaway": [3.2, 1.4],
  "breakout-blue": [2.2, 1.7],
  "fusion-purple": [2.2, 1.7],
  "ky040-dark": [2.7, 3.2],
  "pca9685-blue": [6.4, 2.6],
  "oled-module": [2.8, 2.8],
};

const BATCH23_STYLE_COLORS: Record<Batch23Style, string> = {
  "l298n-red": "#b91d22",
  stepstick: "#b31818",
  "sg90-cutaway": "#145cb6",
  "breakout-blue": "#0f4aa3",
  "fusion-purple": "#5a2286",
  "ky040-dark": "#18181a",
  "pca9685-blue": "#1350a6",
  "oled-module": "#124ea4",
};

/* ------------------------------------------------------------------ */
/*  Silkscreen Texture Helper                                          */
/* ------------------------------------------------------------------ */

/**
 * Generates a 512x512 canvas texture for a given board style.
 * The texture includes:
 *  • Subtle etched copper trace lines (rgba(255,255,255,0.12)).
 *  • ENIG gold solder‑pad rings (#d4af37).
 *  • White component placement boxes.
 *  • Pin‑out labels appropriate to the board style.
 */
function createBoardSilkscreenTexture(
  style: Batch23Style,
  baseColor: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const W = canvas.width;
  const H = canvas.height;

  // Base solder‑mask fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, W, H);

  // Etched copper traces – faint white lines
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < 80; i++) {
    const y = (i * H) / 80;
    ctx.fillRect(0, y, W, 1);
  }

  // Gold ENIG pad helper
  const drawGoldRing = (x: number, y: number, outer: number) => {
    ctx.save();
    ctx.fillStyle = "#d4af37";
    ctx.beginPath();
    ctx.arc(x, y, outer, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.arc(x, y, outer * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // White component boxes & text style
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 2;

  // Per‑style drawing
  switch (style) {
    case "l298n-red": {
      [
        [36, 36],
        [W - 36, 36],
        [36, H - 36],
        [W - 36, H - 36],
      ].forEach(([x, y]) => drawGoldRing(x, y, 14));
      ctx.strokeRect(30, H - 110, W - 60, 80);
      ctx.strokeRect(20, 100, 70, 160);
      ctx.strokeRect(W - 90, 100, 70, 160);
      ctx.strokeRect(100, 60, W - 200, 130);
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("L298N DUAL H‑BRIDGE", W / 2, 230);
      ctx.font = "bold 14px monospace";
      ctx.fillText("ENA  IN1  IN2  IN3  IN4  ENB", W / 2, 265);
      ctx.fillText("+12V   GND   +5V", W / 2, H - 45);
      ctx.font = "bold 13px monospace";
      ctx.fillText("OUT1/OUT2", 60, 280);
      ctx.fillText("OUT3/OUT4", W - 60, 280);
      break;
    }
    case "stepstick": {
      for (let i = 0; i < 8; i++) {
        const y = 50 + i * 58;
        drawGoldRing(24, y, 12);
        drawGoldRing(W - 24, y, 12);
      }
      const left = ["DIR", "STP", "SLP", "RST", "MS3", "MS2", "MS1", "EN"];
      const right = ["VMOT", "GND", "2B", "2A", "1A", "1B", "VDD", "GND"];
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "left";
      left.forEach((lbl, i) => ctx.fillText(lbl, 45, 56 + i * 58));
      ctx.textAlign = "right";
      right.forEach((lbl, i) => ctx.fillText(lbl, W - 45, 56 + i * 58));
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("A4988", W / 2, H / 2 - 25);
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("STEPSTICK", W / 2, H / 2 + 5);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          drawGoldRing(W / 2 - 24 + c * 24, H / 2 + 35 + r * 20, 4);
        }
      }
      break;
    }
    case "sg90-cutaway": {
      drawGoldRing(30, H / 2, 16);
      drawGoldRing(W - 30, H / 2, 16);
      ctx.textAlign = "center";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("SG90 MICRO SERVO", W / 2, H / 2 - 10);
      ctx.font = "bold 14px monospace";
      ctx.fillText("50 Hz PWM • 1.0‑2.0 ms • 9 g", W / 2, H / 2 + 30);
      break;
    }
    case "breakout-blue":
    case "fusion-purple": {
      for (let i = 0; i < 8; i++) {
        const x = 50 + i * 58;
        drawGoldRing(x, H - 35, 12);
      }
      drawGoldRing(40, 40, 14);
      drawGoldRing(W - 40, 40, 14);
      ctx.beginPath();
      ctx.moveTo(W / 2 - 40, H / 2 - 20);
      ctx.lineTo(W / 2 + 40, H / 2 - 20);
      ctx.moveTo(W / 2 + 30, H / 2 - 28);
      ctx.lineTo(W / 2 + 40, H / 2 - 20);
      ctx.lineTo(W / 2 + 30, H / 2 - 12);
      ctx.moveTo(W / 2 - 40, H / 2 - 20);
      ctx.lineTo(W / 2 - 40, H / 2 - 90);
      ctx.moveTo(W / 2 - 48, H / 2 - 80);
      ctx.lineTo(W / 2 - 40, H / 2 - 90);
      ctx.moveTo(W / 2 - 32, H / 2 - 80);
      ctx.stroke();
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("+X", W / 2 + 50, H / 2 - 15);
      ctx.fillText("+Y", W / 2 - 40, H / 2 - 100);
      ctx.beginPath();
      ctx.arc(W / 2 - 40, H / 2 - 20, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2 - 40, H / 2 - 20, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("+Z (UP)", W / 2 - 90, H / 2 - 15);
      ctx.textAlign = "center";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(
        style === "fusion-purple" ? "SENSOR FUSION 6‑DOF" : "GY‑521 / MPU‑6050",
        W / 2,
        60,
      );
      ctx.font = "bold 13px monospace";
      ctx.fillText("VCC GND SCL SDA XDA XCL AD0 INT", W / 2, H - 60);
      break;
    }
    case "ky040-dark": {
      for (let i = 0; i < 5; i++) {
        const x = 90 + i * 82;
        drawGoldRing(x, H - 40, 14);
      }
      drawGoldRing(W / 2, 45, 16);
      ctx.strokeRect(W / 2 - 100, 100, 200, 200);
      ctx.beginPath();
      ctx.arc(W / 2, 200, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("KY‑040 ENCODER", W / 2, 85);
      ctx.font = "bold 16px monospace";
      ctx.fillText("CLK  DT  SW  +  GND", W / 2, H - 75);
      break;
    }
    case "pca9685-blue": {
      [
        [36, 36],
        [W - 36, 36],
        [36, H - 36],
        [W - 36, H - 36],
      ].forEach(([x, y]) => drawGoldRing(x, y, 16));
      for (let i = 0; i < 6; i++) drawGoldRing(36, 120 + i * 50, 10);
      for (let i = 0; i < 6; i++) drawGoldRing(W - 36, 120 + i * 50, 10);
      ctx.textAlign = "center";
      ctx.font = "bold 12px monospace";
      for (let ch = 0; ch < 16; ch++) {
        const x = 110 + ch * 50;
        drawGoldRing(x, 150, 8);
        drawGoldRing(x, 190, 8);
        drawGoldRing(x, 230, 8);
        ctx.fillText(`CH${ch}`, x, 260);
      }
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("16‑CHANNEL 12‑BIT PWM / SERVO DRIVER", W / 2, 70);
      ctx.font = "bold 14px monospace";
      ctx.fillText("PCA9685  [I2C 0x40 – 25 MHz REF OSC]", W / 2, 105);
      ctx.fillText("GND / V+ / PWM", W / 2, 310);
      break;
    }
    case "oled-module": {
      for (let i = 0; i < 4; i++) {
        const x = W / 2 - 90 + i * 60;
        drawGoldRing(x, 40, 12);
      }
      [
        [36, 36],
        [W - 36, 36],
        [36, H - 36],
        [W - 36, H - 36],
      ].forEach(([x, y]) => drawGoldRing(x, y, 14));
      ctx.strokeRect(50, 110, W - 100, H - 160);
      ctx.textAlign = "center";
      ctx.font = "bold 16px monospace";
      ctx.fillText("GND   VCC   SCL   SDA", W / 2, 80);
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("0.96' OLED 128×64", W / 2, H / 2 + 10);
      ctx.font = "bold 14px monospace";
      ctx.fillText("SSD1306 I2C 0x3C", W / 2, H / 2 + 45);
      break;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Batch23PcbBase – 3D PCB base (Figs. 06‑13)                         */
/* ------------------------------------------------------------------ */

export function Batch23PcbBase({
  style,
  boardName,
  explode = 0,
  color,
}: {
  style?: string;
  boardName?: string;
  explode?: number;
  color?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const resolvedStyle =
    (style as Batch23Style) || resolveBatch23Style(boardName) || "l298n-red";
  const [w, d] = BATCH23_STYLE_DIMS[resolvedStyle] ?? [4.4, 4.4];
  const maskColor = color ?? BATCH23_STYLE_COLORS[resolvedStyle];

  const texture = useMemo(
    () => createBoardSilkscreenTexture(resolvedStyle, maskColor),
    [resolvedStyle, maskColor],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (ref.current) ref.current.position.y = -explode * 0.6;
  });

  if (resolvedStyle === "l298n-red") {
    return (
      <group ref={ref}>
        <Fig06L298NPcb color={maskColor} />
      </group>
    );
  }

  return (
    <group ref={ref}>
      {/* PCB substrate */}
      <RoundedBox
        args={[w, 0.12, d]}
        radius={0.06}
        smoothness={4}
        position={[0, -0.06, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={maskColor}
          roughness={0.45}
          metalness={0.08}
        />
      </RoundedBox>

      {/* Silkscreen / copper overlay */}
      <mesh
        position={[0, 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[w * 0.98, d * 0.98]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.4}
          metalness={0.12}
          transparent
        />
      </mesh>

      {/* Corner brass-plated standoffs / holes */}
      {(resolvedStyle === "pca9685-blue" ||
        resolvedStyle === "oled-module") && (
        <group>
          {[
            [-w / 2 + 0.35, -d / 2 + 0.35],
            [w / 2 - 0.35, -d / 2 + 0.35],
            [-w / 2 + 0.35, d / 2 - 0.35],
            [w / 2 - 0.35, d / 2 - 0.35],
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
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Realistic Part Assemblies                                           */
/* ------------------------------------------------------------------ */

/** L298N motor driver – Multiwatt‑15 IC, 15 staggered silver pins, 7‑fin black heatsink */
function L298NAssembly() {
  const finCount = 8;
  const finSpan = 2.2;
  const finSpacing = finSpan / (finCount - 1);
  return (
    <group>
      {/* Heatsink base slab */}
      <group position={[0, 0.85, -0.3]}>
        <mesh position={[0, 0, 0.12]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 1.7, 0.24]} />
          <meshStandardMaterial
            color="#1e1f22"
            metalness={0.82}
            roughness={0.35}
          />
        </mesh>
        {/* Cooling fins */}
        {Array.from({ length: finCount }).map((_, i) => (
          <mesh
            key={i}
            position={[-finSpan / 2 + i * finSpacing, 0, -0.32]}
            castShadow
          >
            <boxGeometry args={[0.07, 1.7, 0.65]} />
            <meshStandardMaterial
              color="#1a1b1d"
              metalness={0.85}
              roughness={0.32}
            />
          </mesh>
        ))}
        {/* Mounting screw & hex nut */}
        <mesh
          position={[0, 0.42, 0.28]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.14, 0.14, 0.12, 12]} />
          <meshStandardMaterial
            color="#cfd2d6"
            metalness={0.92}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* IC package */}
      <group position={[0, 0.55, -0.05]}>
        {/* Heat spreader tab */}
        <mesh position={[0, 0.28, -0.08]} castShadow>
          <boxGeometry args={[1.8, 0.65, 0.05]} />
          <meshStandardMaterial
            color="#c5c8cc"
            metalness={0.95}
            roughness={0.2}
          />
        </mesh>
        {/* Epoxy body */}
        <mesh position={[0, -0.05, 0]} castShadow>
          <boxGeometry args={[1.9, 0.72, 0.36]} />
          <meshStandardMaterial
            color="#171718"
            roughness={0.45}
            metalness={0.06}
          />
        </mesh>
        {/* Laser‑etched badge
         */}
        <mesh position={[0, -0.05, 0.185]}>
          <planeGeometry args={[1.1, 0.28]} />
          <meshStandardMaterial
            color="#dcdcdc"
            roughness={0.6}
            metalness={0.1}
          />
        </mesh>
        {/* 15 staggered pins */}
        {Array.from({ length: 15 }).map((_, i) => {
          const x = -0.7 + i * 0.1;
          const zOff = i % 2 === 0 ? 0.08 : -0.08;
          return (
            <mesh key={i} position={[x, -0.48, zOff]}>
              <boxGeometry args={[0.04, 0.24, 0.04]} />
              <meshStandardMaterial
                color="#d0d4d8"
                metalness={0.9}
                roughness={0.25}
              />
            </mesh>
          );
        })}
        {/* Flyback diodes (1N4007) */}
        <group position={[0, 0, 0.45]}>
          {[-0.65, 0.65].map((x, col) => (
            <group key={col} position={[x, 0, 0]}>
              {[-0.2, 0.2].map((z, row) => (
                <group key={row} position={[0, 0.08, z]}>
                  <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.08, 0.08, 0.28, 12]} />
                    <meshStandardMaterial color="#141414" roughness={0.4} />
                  </mesh>
                  {/* Silver cathode band */}
                  <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.082, 0.082, 0.05, 12]} />
                    <meshStandardMaterial
                      color="#cfcfcf"
                      metalness={0.8}
                      roughness={0.3}
                    />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/** A4988 StepStick – black QFN‑28 plus anodized‑blue finned heatsink */
function StepStickAssembly() {
  return (
    <group>
      {/* QFN‑28 driver IC */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.55, 0.08, 0.55]} />
        <meshStandardMaterial color="#161617" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Blue anodized stick‑on heatsink */}
      <group position={[0, 0.24, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.12, 0.9]} />
          <meshStandardMaterial
            color="#1976d2"
            metalness={0.88}
            roughness={0.28}
          />
        </mesh>
        {/* Five cooling fins */}
        {[-0.34, -0.17, 0, 0.17, 0.34].map((z, i) => (
          <mesh key={i} position={[0, 0.2, z]} castShadow>
            <boxGeometry args={[0.88, 0.3, 0.06]} />
            <meshStandardMaterial
              color="#1976d2"
              metalness={0.88}
              roughness={0.28}
            />
          </mesh>
        ))}
      </group>

      {/* VREF trimpot */}
      <group position={[0.45, 0.08, 0.55]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
          <meshStandardMaterial
            color="#c9cbcf"
            metalness={0.92}
            roughness={0.25}
          />
        </mesh>
        {/* Slot cuts */}
        <mesh position={[0, 0.052, 0]}>
          <boxGeometry args={[0.2, 0.02, 0.04]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <mesh position={[0, 0.052, 0]}>
          <boxGeometry args={[0.04, 0.02, 0.2]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      </group>

      {/* Current‑sense resistors (R100) */}
      {[-0.38, 0.38].map((x, i) => (
        <mesh key={i} position={[x, 0.04, -0.65]}>
          <boxGeometry args={[0.24, 0.06, 0.14]} />
          <meshStandardMaterial color="#2a5f32" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** SG90 cut‑away servo – clear blue housing, brushed motor, 4 white gears, pot, sweeping horn */
function Sg90ServoAssembly({ lit }: { lit: boolean }) {
  const hornRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!hornRef.current) return;
    hornRef.current.rotation.y = lit
      ? Math.sin(state.clock.getElapsedTime() * 3.2) * (Math.PI / 3)
      : 0;
  });

  return (
    <group>
      {/* Polycarbonate housing */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.78, 0.9, 1.45]} />
        <meshPhysicalMaterial
          color="#1664c0"
          roughness={0.22}
          metalness={0.08}
          transmission={0.65}
          opacity={0.8}
          transparent
          ior={1.48}
        />
      </mesh>

      {/* Brushed DC motor core
       */}
      <group position={[0, 0.32, -0.3]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.65, 16]} />
          <meshStandardMaterial
            color="#d8dbde"
            metalness={0.94}
            roughness={0.22}
          />
        </mesh>
        {/* Brass pinion gear */}
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 12]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* Gear train – 4 white spur gears */}
      <group position={[0, 0.62, 0.25]}>
        {/* Stage 1 */}
        <mesh position={[0, -0.15, -0.18]}>
          <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
          <meshStandardMaterial color="#f2f2ee" roughness={0.4} />
        </mesh>
        {/* Stage 2 compound */}
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.1, 16]} />
          <meshStandardMaterial color="#f2f2ee" roughness={0.4} />
        </mesh>
        {/* Output brass‑splined shaft */}
        <mesh position={[0, 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.22, 16]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* Sweeping horn */}
      <group ref={hornRef} position={[0, 0.98, 0.25]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
          <meshStandardMaterial color="#f8f8f6" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.045, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 12]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
        {[-1, 1].map((dir) => (
          <group key={dir}>
            <mesh position={[dir * 0.45, 0, 0]} castShadow>
              <boxGeometry args={[0.7, 0.06, 0.18]} />
              <meshStandardMaterial color="#f8f8f6" roughness={0.35} />
            </mesh>
            {[0.25, 0.45, 0.65].map((dist, k) => (
              <mesh key={k} position={[dir * dist, 0.032, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.02, 8]} />
                <meshStandardMaterial color="#111" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/** SSD1306 0.96" OLED – glossy black bezel, copper flex ribbon, cyan emissive texture when lit */
function OledAssembly({ lit }: { lit: boolean }) {
  const waveTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(c);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 256; i++) {
      const y = 128 + Math.sin((i / 256) * Math.PI * 4) * 60;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group>
      {/* Black glossy bezel */}
      <mesh position={[0, 0.001, 0]} castShadow>
        <planeGeometry args={[2.2, 2.2]} />
        <meshStandardMaterial
          color="#0a0a0a"
          roughness={0.3}
          metalness={0.2}
          transparent
          opacity={0.95}
        />
      </mesh>
      {/* Cyan waveform when lit */}
      {lit && (
        <mesh position={[0, 0.002, 0]}>
          <planeGeometry args={[1.8, 1.8]} />
          <meshStandardMaterial
            map={waveTex}
            emissive="#00ffff"
            emissiveIntensity={2}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </group>
  );
}

/** Phoenix screw terminals – blue/green body with recessed slots */
function ScrewAssembly() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.6, 0.2, 0.3]} />
        <meshStandardMaterial color="#004080" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={i} position={[x, 0.1, 0]} castShadow>
          <boxGeometry args={[0.08, 0.02, 0.28]} />
          <meshStandardMaterial color="#003060" />
        </mesh>
      ))}
    </group>
  );
}

/** Black shunt jumper – gold header pins */
function JumperAssembly() {
  return (
    <group>
      <mesh position={[0.8, 0, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.02, 12]} />
        <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.2} />
      </mesh>
      {[-0.04, 0.04].map((z, i) => (
        <mesh key={i} position={[0.8, 0.01, z]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.04, 8]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Batch23PartGeo – Dispatch component for each part kind              */
/* ------------------------------------------------------------------ */

export function Batch23PartGeo({
  part,
  lit,
}: {
  part: Part;
  lit: boolean;
  energy?: number;
}) {
  if (
    part.kind === "motorDriver" ||
    part.kind === "diode" ||
    part.kind === "screw" ||
    part.kind === "jumper"
  ) {
    return <Fig06L298NPart part={part} lit={lit} />;
  }

  switch (part.kind) {
    case "stepperDriver":
      return <StepStickAssembly />;
    case "servo":
      return <Sg90ServoAssembly lit={lit} />;
    case "oled":
      return <OledAssembly lit={lit} />;
    default:
      return null;
  }
}

/* Export sub‑assemblies for external use if needed */
export {
  L298NAssembly,
  StepStickAssembly,
  Sg90ServoAssembly,
  OledAssembly,
  ScrewAssembly,
  JumperAssembly,
};
