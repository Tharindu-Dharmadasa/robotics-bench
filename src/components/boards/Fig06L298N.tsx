import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { Part } from "../../types/simulator";

const PCB_T = 0.16;

function createL298NTexture(soldermaskHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = soldermaskHex || "#b82428";
  ctx.fillRect(0, 0, 512, 512);

  // Routed 45-degree copper traces underneath soldermask
  ctx.strokeStyle = "rgba(255, 195, 195, 0.16)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const tracePaths = [
    [
      { x: 180, y: 150 },
      { x: 180, y: 240 },
      { x: 80, y: 240 },
    ],
    [
      { x: 210, y: 150 },
      { x: 210, y: 290 },
      { x: 80, y: 290 },
    ],
    [
      { x: 302, y: 150 },
      { x: 302, y: 240 },
      { x: 432, y: 240 },
    ],
    [
      { x: 332, y: 150 },
      { x: 332, y: 290 },
      { x: 432, y: 290 },
    ],
    [
      { x: 256, y: 150 },
      { x: 256, y: 460 },
    ],
    [
      { x: 136, y: 310 },
      { x: 192, y: 310 },
      { x: 192, y: 460 },
    ],
    [
      { x: 310, y: 410 },
      { x: 450, y: 410 },
    ],
  ];

  tracePaths.forEach((pts) => {
    ctx.beginPath();
    pts.forEach((pt, i) =>
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y),
    );
    ctx.stroke();
  });

  // Gold ENIG corner mounting rings + drill holes
  const drawGoldPad = (x: number, y: number, r: number) => {
    ctx.fillStyle = "#d8b85a";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#181818";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
  };

  const cornerPads = [
    { x: 36, y: 36 },
    { x: 476, y: 36 },
    { x: 36, y: 476 },
    { x: 476, y: 476 },
  ];
  cornerPads.forEach((pt) => drawGoldPad(pt.x, pt.y, 16));

  // White silkscreen component outlines aligned to 3D parts
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = 2.5;

  ctx.strokeRect(128, 36, 256, 115);
  ctx.strokeRect(108, 178, 86, 118);
  ctx.strokeRect(318, 178, 86, 118);

  const capCenters = [
    { cx: 96, cy: 394 },
    { cx: 296, cy: 394 },
  ];
  capCenters.forEach(({ cx, cy }) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 28, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.fill();
  });

  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.fillText("L298N", 256, 185);
  ctx.font = "bold 12px monospace";
  ctx.fillText("5V-EN", 192, 332);
  ctx.fillText("78M05", 136, 332);
  ctx.fillText("PWR", 302, 342);

  ctx.font = "bold 13px monospace";
  ctx.fillText("+12V   GND   +5V", 256, 498);
  ctx.fillText("ENA IN1 IN2 IN3 IN4 ENB", 385, 428);

  ctx.save();
  ctx.translate(64, 260);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("OUT1   OUT2", 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(448, 260);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("OUT3   OUT4", 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Fig06L298NPcb({ color }: { color: string }) {
  const texture = useMemo(() => createL298NTexture(color), [color]);

  return (
    <group>
      <RoundedBox
        args={[4.4, PCB_T, 4.4]}
        radius={0.07}
        smoothness={3}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial map={texture} roughness={0.42} metalness={0.05} />
      </RoundedBox>
    </group>
  );
}

export function Fig06L298NPart({ part }: { part: Part; lit?: boolean }) {
  switch (part.kind) {
    case "motorDriver":
      return (
        <group>
          <mesh position={[0, 0.9, -0.16]} castShadow>
            <boxGeometry args={[2.15, 1.8, 0.22]} />
            <meshStandardMaterial
              color="#18181b"
              metalness={0.78}
              roughness={0.32}
            />
          </mesh>
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i} position={[-0.9 + i * 0.3, 0.9, -0.35]} castShadow>
              <boxGeometry args={[0.08, 1.8, 0.22]} />
              <meshStandardMaterial
                color="#18181b"
                metalness={0.82}
                roughness={0.28}
              />
            </mesh>
          ))}
          <mesh position={[0, 0.68, 0.04]} castShadow>
            <boxGeometry args={[1.88, 1.15, 0.2]} />
            <meshStandardMaterial color="#161616" roughness={0.55} />
          </mesh>
          <mesh position={[0, 1.05, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.06, 16]} />
            <meshStandardMaterial
              color="#d4d4d8"
              metalness={0.92}
              roughness={0.2}
            />
          </mesh>
          {Array.from({ length: 15 }).map((_, i) => (
            <mesh
              key={i}
              position={[-0.84 + i * 0.12, 0.14, i % 2 === 0 ? 0.14 : 0.08]}
            >
              <boxGeometry args={[0.04, 0.28, 0.04]} />
              <meshStandardMaterial
                color="#d4d4d8"
                metalness={0.92}
                roughness={0.18}
              />
            </mesh>
          ))}
        </group>
      );

    case "diode":
      return (
        <group>
          {[-0.36, -0.12, 0.12, 0.36].map((zOff, idx) => (
            <group key={idx} position={[0, 0.11, zOff]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.075, 0.075, 0.34, 16]} />
                <meshStandardMaterial color="#141414" roughness={0.35} />
              </mesh>
              <mesh position={[0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.078, 0.078, 0.055, 16]} />
                <meshStandardMaterial
                  color="#e4e4e7"
                  metalness={0.75}
                  roughness={0.25}
                />
              </mesh>
              <mesh position-x={0} position-y={0} position-z={0}>
                <boxGeometry args={[0.56, 0.025, 0.025]} />
                <meshStandardMaterial
                  color="#d4d4d8"
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[-0.27, -0.055, 0]}>
                <boxGeometry args={[0.025, 0.11, 0.025]} />
                <meshStandardMaterial
                  color="#d4d4d8"
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0.27, -0.055, 0]}>
                <boxGeometry args={[0.025, 0.11, 0.025]} />
                <meshStandardMaterial
                  color="#d4d4d8"
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      );

    case "screw": {
      const cavities = part.n || 3;
      const width = cavities * 0.42;
      return (
        <group rotation={[0, part.rot || 0, 0]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <boxGeometry args={[width, 0.56, 0.52]} />
            <meshStandardMaterial color="#165ab8" roughness={0.42} />
          </mesh>
          {Array.from({ length: cavities }).map((_, i) => {
            const x = -((cavities - 1) * 0.42) / 2 + i * 0.42;
            return (
              <group key={i} position={[x, 0, 0]}>
                <mesh position={[0, 0.22, 0.265]}>
                  <boxGeometry args={[0.24, 0.24, 0.02]} />
                  <meshStandardMaterial color="#09090b" />
                </mesh>
                <mesh position={[0, 0.565, 0]}>
                  <cylinderGeometry args={[0.11, 0.11, 0.03, 16]} />
                  <meshStandardMaterial
                    color="#d4d4d8"
                    metalness={0.9}
                    roughness={0.2}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    }

    case "jumper":
      return (
        <group>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.42]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <mesh position={[0, 0.24, 0]} castShadow>
            <boxGeometry args={[0.24, 0.3, 0.44]} />
            <meshStandardMaterial color="#111113" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.1, 0.02, 0.24]} />
            <meshStandardMaterial
              color="#d8b85a"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}
