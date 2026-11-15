import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { PCB_T } from "../data/boards";
import type { Part } from "../types/simulator";

const dark = "#1a1a1a";
const metal = "#c9c9c9";

export function Geo({ part, lit }: { part: Part; lit: boolean }) {
  switch (part.kind) {
    case "dip":
      return (
        <group>
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[2.6, 0.12, 0.85]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[2.4, 0.2, 0.6]} />
            <meshStandardMaterial color={dark} roughness={0.6} />
          </mesh>
          {Array.from({ length: 28 }).map((_, i) => (
            <mesh
              key={i}
              position={[-1.1 + (i % 14) * 0.17, 0.12, i < 14 ? 0.33 : -0.33]}
            >
              <boxGeometry args={[0.06, 0.1, 0.1]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          ))}
          <mesh position={[-1.1, 0.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.06, 16]} />
            <meshStandardMaterial color="#444" />
          </mesh>
        </group>
      );
    case "qfp":
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[0.5, 0.08, 0.5]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          {[0, 1, 2, 3].map((s) => (
            <mesh
              key={s}
              rotation={[0, (s * Math.PI) / 2, 0]}
              position={[0, 0.02, 0]}
            >
              <boxGeometry args={[0.62, 0.02, 0.4]} />
              <meshStandardMaterial color={metal} metalness={0.8} />
            </mesh>
          ))}
        </group>
      );
    case "usb":
      return (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.6, 0.8, 1.2]} />
            <meshStandardMaterial
              color="#d6d6d6"
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[-0.81, 0.4, 0]}>
            <boxGeometry args={[0.02, 0.5, 0.75]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      );
    case "jack":
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[1.4, 0.9, 0.9]} />
            <meshStandardMaterial color="#141414" roughness={0.5} />
          </mesh>
          <mesh position={[-0.71, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.02, 24]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      );
    case "xtal":
      return (
        <mesh position={[0, 0.15, 0]} castShadow scale={[1, 1, 0.4]}>
          <capsuleGeometry args={[0.13, 0.35, 6, 16]} />
          <meshStandardMaterial
            color="#d8d8d8"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      );
    case "btn":
      return (
        <group>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.5, 0.2, 0.5]} />
            <meshStandardMaterial color="#bbb" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.12, 20]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      );
    case "hdr": {
      const n = part.n || 8;
      return (
        <group rotation={[0, part.rot || 0, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[n * 0.25, 0.4, 0.25]} />
            <meshStandardMaterial color="#151515" />
          </mesh>
          {Array.from({ length: n }).map((_, i) => (
            <mesh
              key={i}
              position={[-((n - 1) * 0.25) / 2 + i * 0.25, 0.401, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.1, 0.1]} />
              <meshStandardMaterial color="#000" />
            </mesh>
          ))}
        </group>
      );
    }
    case "cap":
      return (
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.18, 0.08, 0.1]} />
          <meshStandardMaterial color="#b58a4a" />
        </mesh>
      );
    case "res":
      return (
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.18, 0.06, 0.1]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      );
    case "fuse":
      return (
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.35, 0.12, 0.2]} />
          <meshStandardMaterial color="#2a5d2a" />
        </mesh>
      );
    case "reg":
      return (
        <group>
          <mesh position={[0, 0.07, 0]} castShadow>
            <boxGeometry args={[0.45, 0.14, 0.4]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0, 0.03, -0.28]}>
            <boxGeometry args={[0.4, 0.04, 0.2]} />
            <meshStandardMaterial color={metal} metalness={0.8} />
          </mesh>
        </group>
      );
    case "ecap":
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.6, 24]} />
            <meshStandardMaterial color="#1c2f6b" />
          </mesh>
          <mesh position={[0, 0.605, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.01, 24]} />
            <meshStandardMaterial color={metal} metalness={0.9} />
          </mesh>
        </group>
      );
    case "led":
      return (
        <group>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.16, 0.08, 0.1]} />
            <meshStandardMaterial
              color={lit ? part.color : "#eee8d0"}
              emissive={part.color}
              emissiveIntensity={lit ? 3 : 0}
            />
          </mesh>
          {lit && (
            <pointLight
              position={[0, 0.3, 0]}
              color={part.color}
              intensity={1.5}
              distance={1.5}
            />
          )}
        </group>
      );
  }
}

export function AnimatedPart({
  part,
  placed,
  explode,
  lit,
  onHover,
}: {
  part: Part;
  placed: boolean;
  explode: number;
  lit: boolean;
  onHover: (s: string | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const layer = part.smd ? 1 : part.kind === "hdr" ? 3 : 2;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const ty = placed ? PCB_T / 2 + explode * layer * 1.1 : 7;
    const k = 1 - Math.exp(-dt * (placed ? 7 : 4));
    g.position.y += (ty - g.position.y) * k;
    const s = placed ? 1 : 0.001;
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k);
    g.rotation.y += ((placed ? 0 : 2) - g.rotation.y) * k;
  });
  return (
    <group
      ref={ref}
      position={[part.p[0], 7, part.p[1]]}
      scale={0.001}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(part.name);
      }}
      onPointerOut={() => onHover(null)}
    >
      <Geo part={part} lit={lit} />
    </group>
  );
}

export function SolderJoints({
  show,
  explode,
  parts,
}: {
  show: boolean;
  explode: number;
  parts: Part[];
}) {
  const ref = useRef<THREE.Group>(null);
  const pts = useMemo(() => {
    const a: [number, number][] = [];
    parts
      .filter((p) => !p.smd)
      .forEach((p) => {
        if (p.kind === "hdr") {
          const n = p.n || 8;
          for (let i = 0; i < n; i++) {
            const o = -((n - 1) * 0.25) / 2 + i * 0.25;
            a.push(p.rot ? [p.p[0], p.p[1] + o] : [p.p[0] + o, p.p[1]]);
          }
        } else if (p.kind === "dip")
          for (let i = 0; i < 28; i++)
            a.push([
              p.p[0] - 1.1 + (i % 14) * 0.17,
              p.p[1] + (i < 14 ? 0.33 : -0.33),
            ]);
        else {
          a.push([p.p[0] - 0.25, p.p[1]]);
          a.push([p.p[0] + 0.25, p.p[1]]);
        }
      });
    return a;
  }, [parts]);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = show ? 1 : 0.001;
    g.scale.y += (t - g.scale.y) * (1 - Math.exp(-dt * 5));
    g.scale.x = g.scale.z = g.scale.y > 0.01 ? 1 : 0.001;
    g.position.y = -explode * 0.6 - PCB_T / 2;
  });
  return (
    <group ref={ref} scale={[0.001, 0.001, 0.001]}>
      {pts.map((p, i) => (
        <mesh key={i} position={[p[0], -0.03, p[1]]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.07, 0.08, 10]} />
          <meshStandardMaterial
            color="#e0e0e0"
            metalness={1}
            roughness={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

export function UsbCable({
  plugged,
  explode,
}: {
  plugged: boolean;
  explode: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.8, 0, 0),
        new THREE.Vector3(-2.5, 0, 0),
        new THREE.Vector3(-4, -0.4, 1.5),
        new THREE.Vector3(-5.5, -0.5, 4),
      ]),
    [],
  );
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const tx = plugged ? -3.85 : -6.5;
    g.position.x += (tx - g.position.x) * (1 - Math.exp(-dt * 5));
    g.position.y = PCB_T / 2 + 0.4 + explode * 2 * 1.1;
  });
  return (
    <group ref={ref} position={[-6.5, 0.5, 1.4]}>
      <mesh castShadow>
        <boxGeometry args={[1.0, 0.7, 1.0]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
      </mesh>
      <mesh position={[0.6, 0, 0]}>
        <boxGeometry args={[0.3, 0.45, 0.7]} />
        <meshStandardMaterial color={metal} metalness={0.9} />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[curve, 40, 0.13, 10]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Pcb({
  color,
  explode,
  generic,
}: {
  color: string;
  explode: number;
  generic?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = -explode * 0.6;
  });
  const holes: [number, number][] = [
    [-2.9, 2.3],
    [3.1, 2.3],
    [3.1, -2.3],
    [-1.9, -2.3],
  ];
  return (
    <group ref={ref}>
      <RoundedBox
        args={generic ? [4, PCB_T, 2.6] : [6.9, PCB_T, 5.3]}
        radius={0.07}
        smoothness={3}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {!generic &&
        holes.map((h, i) => (
          <mesh
            key={i}
            position={[h[0], PCB_T / 2 + 0.002, h[1]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.1, 0.18, 24]} />
            <meshStandardMaterial
              color="#d8c27a"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
        ))}
      {!generic &&
        Array.from({ length: 14 }).map((_, i) => (
          <mesh
            key={"t" + i}
            position={[-1.5 + i * 0.3, PCB_T / 2 + 0.001, 0.8 - (i % 3) * 0.6]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.03, 1.4]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.12} />
          </mesh>
        ))}
      {generic && (
        <group position={[0, PCB_T / 2, 0]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[1.2, 0.2, 1.2]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0, 0.2, 1.1]} castShadow>
            <boxGeometry args={[3, 0.4, 0.25]} />
            <meshStandardMaterial color="#151515" />
          </mesh>
        </group>
      )}
    </group>
  );
}
