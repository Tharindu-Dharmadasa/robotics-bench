import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { PCB_T } from "../data/boards";
import type { Part } from "../types/simulator";

const dark = "#1a1a1a";
const metal = "#c9c9c9";

function ServoHorn({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = active
      ? Math.sin(state.clock.elapsedTime * 2.2) * 0.65
      : 0;
    g.rotation.y += (target - g.rotation.y) * (1 - Math.exp(-dt * 6));
  });
  return (
    <group ref={ref} position={[0, 0.64, 0]}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
        <meshStandardMaterial color="#f2f2ea" roughness={0.65} />
      </mesh>
      <mesh position={[0.17, 0.06, 0]} castShadow>
        <boxGeometry args={[0.36, 0.05, 0.09]} />
        <meshStandardMaterial color="#f7f7f0" roughness={0.55} />
      </mesh>
      <mesh position={[-0.13, 0.06, 0]} castShadow>
        <boxGeometry args={[0.2, 0.05, 0.09]} />
        <meshStandardMaterial color="#e9e9df" roughness={0.6} />
      </mesh>
    </group>
  );
}

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
    case "esp32":
      return (
        <group>
          <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.9, 0.08, 1.05]} />
            <meshStandardMaterial color="#151515" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.15, 0.02]} castShadow>
            <boxGeometry args={[1.15, 0.14, 0.72]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.9}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.225, 0.02]}>
            <boxGeometry args={[0.8, 0.01, 0.45]} />
            <meshStandardMaterial
              color="#b5b5b5"
              metalness={0.9}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0.84, 0.085, 0]}>
            <boxGeometry args={[0.02, 0.006, 0.6]} />
            <meshStandardMaterial
              color="#d9b45a"
              metalness={1}
              roughness={0.2}
            />
          </mesh>
          {[-0.21, -0.07, 0.07, 0.21].map((z) => (
            <mesh key={z} position={[0.75, 0.085, z]}>
              <boxGeometry args={[0.18, 0.006, 0.02]} />
              <meshStandardMaterial
                color="#d9b45a"
                metalness={1}
                roughness={0.2}
              />
            </mesh>
          ))}
          {[-0.44, 0.44].map((z) => (
            <group key={z}>
              {Array.from({ length: 10 }).map((_, i) => (
                <mesh key={i} position={[-0.81 + i * 0.18, 0.06, z]}>
                  <boxGeometry args={[0.05, 0.04, 0.12]} />
                  <meshStandardMaterial
                    color={metal}
                    metalness={0.85}
                    roughness={0.25}
                  />
                </mesh>
              ))}
            </group>
          ))}
          <mesh position={[-0.87, 0.1, 0]} castShadow>
            <boxGeometry args={[0.16, 0.12, 0.28]} />
            <meshStandardMaterial
              color="#d6d6d6"
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
        </group>
      );
    case "ultrasonic":
      return (
        <group>
          <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.08, 0.8]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.55} />
          </mesh>
          {[-0.48, 0.48].map((x) => (
            <group key={x} position={[x, 0.08, 0]}>
              <mesh position={[0, 0.18, 0]} castShadow>
                <cylinderGeometry args={[0.28, 0.28, 0.36, 32]} />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.9}
                  roughness={0.22}
                />
              </mesh>
              <mesh position={[0, 0.365, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.22, 32]} />
                <meshStandardMaterial
                  color="#3a3a3a"
                  metalness={0.4}
                  roughness={0.5}
                />
              </mesh>
              <mesh position={[0, 0.368, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.205, 0.245, 32]} />
                <meshStandardMaterial
                  color="#8a8a8a"
                  metalness={0.9}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.28, 0.12, 0.2]} />
            <meshStandardMaterial
              color="#d8d8d8"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[-0.24 + i * 0.16, 0.07, 0.3]}>
              <boxGeometry args={[0.055, 0.05, 0.1]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>
          ))}
        </group>
      );
    case "motorDriver":
      return (
        <group>
          <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.9, 0.08, 1.25]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.55} />
          </mesh>
          <mesh position={[-0.1, 0.42, -0.28]} castShadow>
            <boxGeometry args={[0.95, 0.68, 0.12]} />
            <meshStandardMaterial color={dark} roughness={0.55} />
          </mesh>
          <mesh position={[-0.1, 0.42, -0.355]}>
            <boxGeometry args={[1.05, 0.55, 0.02]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
          {Array.from({ length: 15 }).map((_, i) => (
            <mesh key={i} position={[-0.5 + i * 0.075, 0.12, -0.2]}>
              <boxGeometry args={[0.03, 0.16, 0.04]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
          ))}
          <group position={[0, 0.08, 0.06]}>
            <mesh position={[0, 0.02, 0]} castShadow>
              <boxGeometry args={[0.5, 0.04, 0.42]} />
              <meshStandardMaterial
                color="#1b1b1b"
                metalness={0.75}
                roughness={0.35}
              />
            </mesh>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh
                key={i}
                position={[0, 0.2, (i - 2) * 0.09]}
                castShadow
              >
                <boxGeometry args={[0.5, 0.36, 0.035]} />
                <meshStandardMaterial
                  color="#1b1b1b"
                  metalness={0.75}
                  roughness={0.35}
                />
              </mesh>
            ))}
          </group>
          {[-0.62, 0.62].map((x) => (
            <group key={x} position={[x, 0.18, 0.42]}>
              <mesh castShadow>
                <boxGeometry args={[0.42, 0.24, 0.4]} />
                <meshStandardMaterial color="#1f5fa8" roughness={0.5} />
              </mesh>
              {[-0.12, 0.12].map((dx) => (
                <mesh
                  key={dx}
                  position={[dx, 0.13, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <circleGeometry args={[0.055, 16]} />
                  <meshStandardMaterial
                    color="#0d0d0d"
                    metalness={0.4}
                    roughness={0.6}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    case "stepperDriver":
      return (
        <group>
          <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.15, 0.07, 0.8]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.13, 0]} castShadow>
            <boxGeometry args={[0.46, 0.12, 0.46]} />
            <meshStandardMaterial color="#141414" roughness={0.5} />
          </mesh>
          <group position={[0, 0.19, 0]}>
            <mesh position={[0, 0.01, 0]}>
              <boxGeometry args={[0.44, 0.03, 0.36]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh
                key={i}
                position={[(i - 2) * 0.075, 0.12, 0]}
                castShadow
              >
                <boxGeometry args={[0.035, 0.24, 0.34]} />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.9}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>
          <group position={[0.4, 0.12, 0.25]}>
            <mesh castShadow>
              <boxGeometry args={[0.15, 0.1, 0.15]} />
              <meshStandardMaterial
                color="#d8d8d8"
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.1, 0.025]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh
              position={[0, 0.052, 0]}
              rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            >
              <planeGeometry args={[0.1, 0.025]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          </group>
          {[-0.36, 0.36].map((z) => (
            <group key={z}>
              {Array.from({ length: 8 }).map((_, i) => (
                <mesh key={i} position={[-0.4375 + i * 0.125, 0.09, z]}>
                  <boxGeometry args={[0.04, 0.04, 0.06]} />
                  <meshStandardMaterial
                    color={metal}
                    metalness={0.8}
                    roughness={0.3}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    case "servo":
      return (
        <group>
          <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.08, 0.62]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.34, 0.5, 0.54]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.45} />
          </mesh>
          {[-0.28, 0.28].map((x) => (
            <mesh key={x} position={[x, 0.06, 0]} castShadow>
              <boxGeometry args={[0.22, 0.06, 0.45]} />
              <meshStandardMaterial color="#1f6fb2" roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 0.57, 0]} castShadow>
            <boxGeometry args={[0.26, 0.1, 0.5]} />
            <meshStandardMaterial color="#1a5f9c" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.63, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.08, 16]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
          <ServoHorn active={lit} />
        </group>
      );
    case "imu":
      return (
        <group>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.06, 0.9]} />
            <meshStandardMaterial color="#2f7d46" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.34, 0.08, 0.34]} />
            <meshStandardMaterial color="#141414" roughness={0.45} />
          </mesh>
          {[0, 1, 2, 3].map((s) => (
            <mesh
              key={s}
              position={[0, 0.075, 0]}
              rotation={[0, (s * Math.PI) / 2, 0]}
            >
              <boxGeometry args={[0.42, 0.018, 0.26]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
          ))}
          <mesh position={[0, 0.063, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.72, 0.018]} />
            <meshStandardMaterial color="#f0ede2" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 0.063, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.018, 0.72]} />
            <meshStandardMaterial color="#f0ede2" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0.37, 0.075, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.035, 0.1, 12]} />
            <meshStandardMaterial color="#c0392b" />
          </mesh>
          <mesh position={[0, 0.075, 0.37]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.035, 0.1, 12]} />
            <meshStandardMaterial color="#2e8b57" />
          </mesh>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={i} position={[-0.3125 + i * 0.125, 0.075, 0.37]}>
              <boxGeometry args={[0.04, 0.03, 0.08]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    case "encoder":
      return (
        <group>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.85, 0.06, 0.85]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.34, 28]} />
            <meshStandardMaterial
              color="#b9b9b9"
              metalness={0.95}
              roughness={0.22}
            />
          </mesh>
          <group position={[0, 0.26, 0]}>
            <mesh position={[0, 0, -0.32]} castShadow>
              <boxGeometry args={[0.72, 0.5, 0.05]} />
              <meshStandardMaterial
                color="#9fa4a8"
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.335, 0, 0]} castShadow>
                <boxGeometry args={[0.05, 0.5, 0.64]} />
                <meshStandardMaterial
                  color="#9fa4a8"
                  metalness={0.9}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.14, 20]} />
            <meshStandardMaterial color="#a8adb1" metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.26, 20]} />
            <meshStandardMaterial color="#cfcfcf" metalness={0.95} roughness={0.2} />
          </mesh>
          <mesh position={[0.045, 0.57, 0]}>
            <boxGeometry args={[0.03, 0.2, 0.08]} />
            <meshStandardMaterial color="#b8b8b8" metalness={0.95} roughness={0.2} />
          </mesh>
        </group>
      );
    case "oled":
      return (
        <group>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 0.06, 0.9]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.09, 0]} castShadow>
            <boxGeometry args={[1.0, 0.06, 0.66]} />
            <meshStandardMaterial color="#111" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.125, 0]}>
            <boxGeometry args={[0.82, 0.012, 0.48]} />
            <meshStandardMaterial
              color={lit ? "#9ff7ff" : "#061616"}
              emissive="#22dddd"
              emissiveIntensity={lit ? 2.4 : 0.06}
              metalness={0.1}
              roughness={0.15}
            />
          </mesh>
          {lit && (
            <>
              <pointLight
                position={[0, 0.35, 0]}
                color="#66f0ff"
                intensity={1.2}
                distance={1.4}
              />
              {Array.from({ length: 4 }).map((_, i) => (
                <mesh
                  key={i}
                  position={[0, 0.133, -0.15 + i * 0.1]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <planeGeometry args={[0.6, 0.012]} />
                  <meshBasicMaterial color="#c9ffff" transparent opacity={0.55} />
                </mesh>
              ))}
            </>
          )}
          {[
            [-0.55, -0.35],
            [0.55, -0.35],
            [-0.55, 0.35],
            [0.55, 0.35],
          ].map(([x, z]) => (
            <mesh
              key={`${x}-${z}`}
              position={[x, 0.065, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.035, 0.06, 16]} />
              <meshStandardMaterial
                color="#d8c27a"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[-0.15 + i * 0.1, 0.08, 0.38]}>
              <boxGeometry args={[0.04, 0.05, 0.08]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
          ))}
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
