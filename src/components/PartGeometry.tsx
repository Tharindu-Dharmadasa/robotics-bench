import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { PCB_T } from "../data/boards";
import type { Part } from "../types/simulator";
import {
  Batch23PartGeo,
  Batch23PcbBase,
  isBatch23Kind,
  isBatch23Style,
} from "./Batch23Geometry";

const dark = "#1a1a1a";
const metal = "#c9c9c9";

/* ------------------------------------------------------------------ */
/*  Resistor value → 4-band colour code (Brown-Black-…-Gold)           */
/* ------------------------------------------------------------------ */

const BAND = {
  black: "#1a1a1a",
  brown: "#6d4426",
  red: "#c0392b",
  orange: "#e2711d",
  yellow: "#d9b23a",
  gold: "#c9a227",
} as const;

/** First three bands of the 4-band code for a value like "10kΩ" / "1kΩ". */
function resistorBands(value?: string): [string, string, string] {
  const v = (value ?? "").replace(/\s/g, "").toLowerCase();
  if (v.startsWith("100k")) return [BAND.brown, BAND.black, BAND.yellow];
  if (v.startsWith("10k")) return [BAND.brown, BAND.black, BAND.orange];
  if (v.startsWith("1k")) return [BAND.brown, BAND.black, BAND.red];
  if (v.startsWith("330")) return [BAND.orange, BAND.orange, BAND.brown];
  if (v.startsWith("220")) return [BAND.red, BAND.red, BAND.brown];
  if (/^10(?![0k])/.test(v)) return [BAND.brown, BAND.black, BAND.black];
  return [BAND.brown, BAND.black, BAND.red]; // 1kΩ default
}

function ServoHorn({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = active ? Math.sin(state.clock.elapsedTime * 2.2) * 0.65 : 0;
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

/** WS2812 RGB die: smoothly cycles cyan → green → blue while active. */
function Ws2812Die({ active }: { active: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const hue = useRef(0.5);
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    // drift hue through the cyan/green/blue band when powered
    hue.current = active
      ? 0.33 + ((hue.current - 0.33 + dt * 0.22) % 0.32)
      : hue.current;
    const c = new THREE.Color().setHSL(hue.current, 0.95, 0.5);
    m.emissive.lerp(c, 1 - Math.exp(-dt * 8));
    const pulse = active ? 2.4 + Math.sin(Date.now() * 0.006) * 0.6 : 0;
    m.emissiveIntensity +=
      (pulse - m.emissiveIntensity) * (1 - Math.exp(-dt * 6));
    if (light.current)
      light.current.intensity +=
        ((active ? 1.1 : 0) - light.current.intensity) *
        (1 - Math.exp(-dt * 6));
  });
  return (
    <group position={[0, 0.095, 0]}>
      <mesh>
        <boxGeometry args={[0.3, 0.01, 0.3]} />
        <meshStandardMaterial
          ref={mat}
          color="#d8d2c0"
          emissive="#7fffd4"
          emissiveIntensity={0}
        />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.2, 0]}
        distance={1.2}
        intensity={0}
      />
    </group>
  );
}

/** Relay contact armature: clacks between the NO/NC posts while driven. */
function RelayArm({ active }: { active: boolean }) {
  const arm = useRef<THREE.Group>(null);
  const state = useRef(active ? 1 : 0);
  useFrame((_, dt) => {
    const g = arm.current;
    if (!g) return;
    // snap: fast clack between rest and pulled-in
    state.current +=
      ((active ? 1 : 0) - state.current) * (1 - Math.exp(-dt * 26));
    g.rotation.x = 0.45 - state.current * 0.85;
  });
  return (
    <group ref={arm} position={[0.05, 0.42, 0]}>
      {/* moving contact blade */}
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.03, 0.1]} />
        <meshStandardMaterial color="#c9c9c9" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* armature pivot post */}
      <mesh position={[-0.18, -0.04, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.1, 10]} />
        <meshStandardMaterial
          color="#8f9498"
          metalness={0.85}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

/** Relay load-indicator LED: red dot on the cube face, lights while driven. */
function RelayIndicator({ active }: { active: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const target = active ? 3 : 0.15;
    m.emissiveIntensity +=
      (target - m.emissiveIntensity) * (1 - Math.exp(-dt * 10));
  });
  return (
    <mesh position={[-0.3, 0.3, 0.41]}>
      <sphereGeometry args={[0.045, 10, 10]} />
      <meshStandardMaterial
        ref={mat}
        color="#ff4136"
        emissive="#ff2a1a"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

/**
 * Expanding ultrasonic ping rings: a transmit wave travels out from the T
 * transducer toward a virtual target, then the echo ring collapses back onto
 * the R transducer. Active = the board is running its ranging sketch.
 */
function SonarWave({ active }: { active: boolean }) {
  const tx = useRef<THREE.Mesh>(null);
  const rx = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const period = 2.2;
    const p = (t % period) / period;
    const txM = tx.current;
    const rxM = rx.current;
    if (txM) {
      // transmit: first half of the cycle, expanding away along +X
      const q = Math.min(1, p * 2);
      txM.position.x = q * 2.2;
      txM.scale.setScalar(0.15 + q * 1.5);
      const m = txM.material as THREE.MeshStandardMaterial;
      m.opacity = active ? 0.5 * (1 - q) : 0;
      txM.visible = active && q > 0.02;
    }
    if (rxM) {
      // echo: second half, contracting back onto the R can
      const q = Math.max(0, (p - 0.5) * 2);
      rxM.position.x = (1 - q) * 2.2;
      rxM.scale.setScalar(0.15 + (1 - q) * 1.5);
      const m = rxM.material as THREE.MeshStandardMaterial;
      m.opacity = active ? 0.45 * q : 0;
      rxM.visible = active && q > 0.02;
    }
  });
  return (
    <group position={[0.42, 0.66, 0]}>
      {/* rings stand vertical, facing +X (the acoustic axis) */}
      <mesh ref={tx} rotation={[0, 0, Math.PI / 2]} visible={false}>
        <ringGeometry args={[0.8, 0.95, 32]} />
        <meshStandardMaterial
          color="#9fd8ff"
          emissive="#4db8ff"
          emissiveIntensity={1.6}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={rx} rotation={[0, 0, Math.PI / 2]} visible={false}>
        <ringGeometry args={[0.8, 0.95, 32]} />
        <meshStandardMaterial
          color="#bfe9c8"
          emissive="#59d98a"
          emissiveIntensity={1.4}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function Geo({
  part,
  lit,
  energy = 1,
  charred = false,
  damagedPartId,
  faultPartId,
}: {
  part: Part;
  lit: boolean;
  /** Output-energy factor 0..1 (e.g. 10kΩ resistor => dim LED). */
  energy?: number;
  /** Stage 2 of the failure sequence: forwarded to the Batch23 parts. */
  charred?: boolean;
  /** Fault-owner part id + [x, z] coords, forwarded to the Batch23 parts. */
  damagedPartId?: string;
  faultPartId?: [number, number];
}) {
  if (isBatch23Kind(part.kind) && (part.kind !== "diode" || part.id.startsWith("diodes_"))) {
    return (
      <Batch23PartGeo
        part={part}
        lit={lit}
        energy={energy}
        charred={charred}
        damagedPartId={damagedPartId}
        faultPartId={faultPartId}
      />
    );
  }
  switch (part.kind) {
    case "dip": {
      // leg count follows part.n (MAX232 = 16, LM324 = 14, ATmega = 28)
      const per = Math.ceil((part.n ?? 28) / 2);
      const span = (per - 1) * 0.17;
      const legX = (i: number) => -span / 2 + (i % per) * 0.17;
      const legZ = (i: number) => (i < per ? 0.33 : -0.33);
      const bodyL = span + 0.5;
      return (
        <group>
          {/* stepped matte-charcoal epoxy body */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[bodyL, 0.12, 0.78]} />
            <meshStandardMaterial
              color="#1c1c1c"
              roughness={0.45}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[bodyL - 0.15, 0.2, 0.6]} />
            <meshStandardMaterial
              color="#1c1c1c"
              roughness={0.42}
              metalness={0.05}
            />
          </mesh>
          {/* moulded index notch on the left end */}
          <mesh
            position={[-bodyL / 2 + 0.05, 0.2, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.11, 0.11, 0.05, 16]} />
            <meshStandardMaterial color="#080808" roughness={0.7} />
          </mesh>
          {/* white pin-1 dot */}
          <mesh
            position={[-span / 2 + 0.08, 0.301, 0.17]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.045, 16]} />
            <meshStandardMaterial color="#f5f5ee" />
          </mesh>
          {/* gull-wing legs, one pair per part.n */}
          {Array.from({ length: per * 2 }).map((_, i) => (
            <group key={i}>
              <mesh position={[legX(i), 0.09, legZ(i) * 1.08]}>
                <boxGeometry args={[0.05, 0.18, 0.04]} />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.85}
                  roughness={0.28}
                />
              </mesh>
              <mesh
                position={[legX(i), 0.015, legZ(i) * 0.94]}
                rotation={[legZ(i) > 0 ? 0.5 : -0.5, 0, 0]}
              >
                <boxGeometry args={[0.05, 0.04, 0.11]} />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.85}
                  roughness={0.28}
                />
              </mesh>
            </group>
          ))}
        </group>
      );
    }
    case "usbc":
      // USB-C receptacle: low flat silver shell with the tongue inside
      return (
        <group>
          <mesh position={[0, 0.11, 0]} castShadow>
            <boxGeometry args={[0.75, 0.22, 0.9]} />
            <meshStandardMaterial
              color="#b9bec2"
              metalness={0.92}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.77, 0.1, 0.92]} />
            <meshStandardMaterial
              color="#8f9498"
              metalness={0.85}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.1, 0.46]}>
            <boxGeometry args={[0.6, 0.03, 0.02]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
        </group>
      );
    case "ws2812":
      // WS2812B: 5mm square white substrate, 4 corner pads, RGB die
      return (
        <group>
          <mesh position={[0, 0.045, 0]} castShadow>
            <boxGeometry args={[0.5, 0.09, 0.5]} />
            <meshStandardMaterial color="#efe9da" roughness={0.5} />
          </mesh>
          {[
            [-0.25, 0],
            [0.25, 0],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.045, z]}>
              <boxGeometry args={[0.06, 0.08, 0.4]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
          ))}
          {[
            [0, -0.25],
            [0, 0.25],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.045, z]}>
              <boxGeometry args={[0.4, 0.08, 0.06]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
          ))}
          <Ws2812Die active={lit} />
        </group>
      );
    case "jumper":
      // Slim vertical Dupont pin plug seated in a breadboard socket. The arched
      // cable itself is drawn by CircuitWireOverlay; this is just the end plug.
      return (
        <group>
          {/* thin gold pin descending into the breadboard hole */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.12, 8]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
          {/* slim vertical Dupont connector boot — never a wide block */}
          <mesh position={[0, 0.13, 0]} castShadow>
            <boxGeometry args={[0.052, 0.15, 0.052]} />
            <meshStandardMaterial color="#18181b" roughness={0.55} />
          </mesh>
          {/* thin colored heat-shrink collar at the top of the boot */}
          <mesh position={[0, 0.205, 0]}>
            <boxGeometry args={[0.056, 0.04, 0.056]} />
            <meshStandardMaterial
              color={part.color || "#dc2626"}
              roughness={0.6}
            />
          </mesh>
        </group>
      );
    case "to92":
      // 2N2222A TO-92: half-cylinder black cap, flat face, 3 leads
      return (
        <group>
          <mesh
            position={[0, 0.15, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            castShadow
          >
            <cylinderGeometry
              args={[0.16, 0.16, 0.3, 20, 1, false, 0, Math.PI]}
            />
            <meshStandardMaterial color="#141414" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.15, -0.075]} castShadow>
            <boxGeometry args={[0.3, 0.32, 0.02]} />
            <meshStandardMaterial color="#141414" roughness={0.45} />
          </mesh>
          {[-0.07, 0, 0.07].map((x) => (
            <mesh key={x} position={[x, 0.05, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.14, 8]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    case "diode":
      // 1N4007 axial: black epoxy cylinder with the silver cathode band
      return (
        <group>
          <mesh
            position={[0, 0.12, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.1, 0.1, 0.34, 16]} />
            <meshStandardMaterial color="#181818" roughness={0.4} />
          </mesh>
          <mesh position={[0.13, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.102, 0.102, 0.045, 16]} />
            <meshStandardMaterial
              color="#d9dde0"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
          {[-0.26, 0.26].map((x) => (
            <mesh
              key={x}
              position={[x, 0.12, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.018, 0.018, 0.18, 8]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    case "relay":
      // SRD-05VDC cube relay: blue plastic cover over black base
      return (
        <group>
          <mesh position={[0, 0.24, 0]} castShadow>
            <boxGeometry args={[0.95, 0.48, 0.8]} />
            <meshStandardMaterial color="#2a5fc8" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.98, 0.06, 0.83]} />
            <meshStandardMaterial color="#0e0e0e" roughness={0.55} />
          </mesh>
          {/* pin field along the bottom */}
          {[-0.35, -0.15, 0.05, 0.25, 0.4].map((x, i) => (
            <mesh key={i} position={[x, 0.0, i % 2 ? 0.28 : -0.28]}>
              <boxGeometry args={[0.07, 0.1, 0.07]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
          ))}
          {/* clicking contact armature + load indicator while the coil is driven */}
          <group position={[0, 0.49, 0]}>
            <RelayArm active={lit} />
          </group>
          <RelayIndicator active={lit} />
        </group>
      );
    case "screw":
      // 2-position screw terminal block: green phenolic + brass screws
      return (
        <group>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.85, 0.24, 0.45]} />
            <meshStandardMaterial color="#2f8f4e" roughness={0.55} />
          </mesh>
          {[-0.2, 0.2].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.26, 0]} castShadow>
                <cylinderGeometry args={[0.09, 0.09, 0.08, 12]} />
                <meshStandardMaterial
                  color="#c9a227"
                  metalness={0.9}
                  roughness={0.35}
                />
              </mesh>
              <mesh position={[x, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.05, 0.02, 0.14]} />
                <meshStandardMaterial
                  color="#7a6215"
                  metalness={0.7}
                  roughness={0.4}
                />
              </mesh>
            </group>
          ))}
          {/* wire entry holes on the side */}
          {[-0.2, 0.2].map((x) => (
            <mesh
              key={x}
              position={[x, 0.1, 0.23]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[0.055, 12]} />
              <meshStandardMaterial color="#0c1a0f" />
            </mesh>
          ))}
        </group>
      );
    case "transducer":
      // HC-SR04 16mm aluminium can: mesh face + rolled rim
      return (
        <group>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.62, 24]} />
            <meshStandardMaterial
              color="#b9bec2"
              metalness={0.92}
              roughness={0.28}
            />
          </mesh>
          {/* silver mesh radiating face (top) */}
          <mesh position={[0, 0.635, 0]}>
            <cylinderGeometry args={[0.415, 0.415, 0.01, 24]} />
            <meshStandardMaterial
              color="#d4d8db"
              metalness={0.95}
              roughness={0.55}
            />
          </mesh>
          {/* mesh grid relief */}
          {[-0.2, 0, 0.2].map((o) => (
            <mesh
              key={`x${o}`}
              position={[0, 0.641, o]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <boxGeometry args={[0.83, 0.004, 0.02]} />
              <meshStandardMaterial
                color="#8a9096"
                metalness={0.9}
                roughness={0.4}
              />
            </mesh>
          ))}
          {[-0.2, 0, 0.2].map((o) => (
            <mesh
              key={`z${o}`}
              position={[o, 0.641, 0]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <boxGeometry args={[0.83, 0.004, 0.02]} />
              <meshStandardMaterial
                color="#8a9096"
                metalness={0.9}
                roughness={0.4}
              />
            </mesh>
          ))}
          {/* rolled rim ring */}
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.44, 0.44, 0.06, 24]} />
            <meshStandardMaterial
              color="#9fa4a8"
              metalness={0.9}
              roughness={0.35}
            />
          </mesh>
          {/* the T can emits the 40 kHz ping rings while the sketch runs */}
          {part.id === "tx1" && <SonarWave active={lit} />}
        </group>
      );
    case "qfp":
      return (
        <group>
          {/* matte charcoal epoxy body */}
          <mesh position={[0, 0.09, 0]} castShadow>
            <boxGeometry args={[0.56, 0.09, 0.56]} />
            <meshStandardMaterial
              color="#1c1c1c"
              roughness={0.42}
              metalness={0.05}
            />
          </mesh>
          {/* white pin-1 dot */}
          <mesh
            position={[-0.19, 0.136, -0.19]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.035, 12]} />
            <meshStandardMaterial color="#f5f5ee" />
          </mesh>
          {/* 32 gull-wing leads, 8 per side */}
          {[0, 1, 2, 3].map((s) =>
            Array.from({ length: 8 }).map((_, i) => (
              <mesh
                key={`${s}-${i}`}
                rotation={[0, (s * Math.PI) / 2, 0]}
                position={[-0.21 + i * 0.06, 0.035, 0.31]}
              >
                <boxGeometry args={[0.035, 0.02, 0.12]} />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.85}
                  roughness={0.3}
                />
              </mesh>
            )),
          )}
        </group>
      );
    case "usb":
      return (
        <group>
          {/* nickel-plated shell */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.6, 0.8, 1.2]} />
            <meshStandardMaterial
              color="#b9bec2"
              metalness={0.92}
              roughness={0.28}
            />
          </mesh>
          {/* top shell seam */}
          <mesh position={[0, 0.806, 0]}>
            <boxGeometry args={[1.6, 0.012, 1.0]} />
            <meshStandardMaterial
              color="#878c90"
              metalness={0.9}
              roughness={0.35}
            />
          </mesh>
          {/* black insert behind the mating face (cable approaches from -X) */}
          <mesh position={[-0.806, 0.4, 0]}>
            <boxGeometry args={[0.02, 0.5, 0.78]} />
            <meshStandardMaterial color="#0c0c0c" roughness={0.6} />
          </mesh>
          {/* crimp tabs at the solder tail */}
          {[-0.42, 0.42].map((z) => (
            <mesh key={z} position={[0.72, 0.4, z]}>
              <boxGeometry args={[0.24, 0.55, 0.06]} />
              <meshStandardMaterial
                color="#9aa0a4"
                metalness={0.9}
                roughness={0.35}
              />
            </mesh>
          ))}
        </group>
      );
    case "jack":
      return (
        <group>
          {/* moulded black housing */}
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[1.4, 0.9, 0.95]} />
            <meshStandardMaterial color="#141414" roughness={0.55} />
          </mesh>
          {/* barrel collar proud of the front face (board edge is -X) */}
          <mesh position={[-0.72, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.3, 0.3, 0.05, 24]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.45} />
          </mesh>
          {/* bore */}
          <mesh position={[-0.75, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 24]} />
            <meshStandardMaterial color="#050505" roughness={0.8} />
          </mesh>
          {/* centre pin */}
          <mesh position={[-0.76, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 12]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
        </group>
      );
    case "xtal":
      return (
        <group>
          {/* hermetically sealed steel can, lying on its side */}
          <mesh
            position={[0, 0.14, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <capsuleGeometry args={[0.12, 0.26, 6, 16]} />
            <meshStandardMaterial
              color="#cfd3d8"
              metalness={0.95}
              roughness={0.18}
            />
          </mesh>
          {/* laser-etched seam ring */}
          <mesh position={[0, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.122, 0.122, 0.02, 16]} />
            <meshStandardMaterial
              color="#9aa0a4"
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
          {/* two solder pads */}
          {[-0.18, 0.18].map((x) => (
            <mesh key={x} position={[x, 0.012, 0]}>
              <boxGeometry args={[0.12, 0.02, 0.22]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    case "btn":
      return (
        <group>
          {/* black base with 4 corner pins */}
          <mesh position={[0, 0.07, 0]} castShadow>
            <boxGeometry args={[0.6, 0.14, 0.6]} />
            <meshStandardMaterial color="#262626" roughness={0.55} />
          </mesh>
          {[
            [-0.24, -0.24],
            [0.24, -0.24],
            [-0.24, 0.24],
            [0.24, 0.24],
          ].map(([x, z]) => (
            <mesh key={`${x}-${z}`} position={[x, 0.03, z]}>
              <boxGeometry args={[0.07, 0.06, 0.07]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
          {/* tin-plated actuator can */}
          <mesh position={[0, 0.19, 0]} castShadow>
            <boxGeometry args={[0.46, 0.1, 0.46]} />
            <meshStandardMaterial
              color="#c3c7cb"
              metalness={0.85}
              roughness={0.35}
            />
          </mesh>
          {/* black plunger */}
          <mesh position={[0, 0.29, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.12, 20]} />
            <meshStandardMaterial color="#131313" roughness={0.5} />
          </mesh>
        </group>
      );
    case "hdr": {
      const n = part.n || 8;
      return (
        <group rotation={[0, part.rot || 0, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[n * 0.25, 0.4, 0.25]} />
            <meshStandardMaterial color="#151515" roughness={0.55} />
          </mesh>
          {Array.from({ length: n }).map((_, i) => (
            <mesh
              key={i}
              position={[-((n - 1) * 0.25) / 2 + i * 0.25, 0.485, 0]}
            >
              <boxGeometry args={[0.09, 0.17, 0.09]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.25}
              />
            </mesh>
          ))}
        </group>
      );
    }
    case "cap":
      return (
        <group>
          {/* tan MLCC ceramic body */}
          <mesh position={[0, 0.045, 0]} castShadow>
            <boxGeometry args={[0.13, 0.07, 0.09]} />
            <meshStandardMaterial color="#c9975a" roughness={0.55} />
          </mesh>
          {/* nickel end terminations */}
          {[-0.072, 0.072].map((x) => (
            <mesh key={x} position={[x, 0.045, 0]}>
              <boxGeometry args={[0.028, 0.08, 0.1]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    case "res": {
      const [b1, b2, b3] = resistorBands(part.value);
      if (part.smd) {
        // SMD 0805: beige ceramic body, nickel ends, 4 value bands on top
        return (
          <group>
            <mesh position={[0, 0.045, 0]} castShadow>
              <boxGeometry args={[0.16, 0.07, 0.09]} />
              <meshStandardMaterial color="#e8dcc3" roughness={0.55} />
            </mesh>
            {[-0.085, 0.085].map((x) => (
              <mesh key={x} position={[x, 0.045, 0]}>
                <boxGeometry args={[0.03, 0.08, 0.1]} />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.9}
                  roughness={0.3}
                />
              </mesh>
            ))}
            {[b1, b2, b3, BAND.gold].map((c, i) => (
              <mesh
                key={i}
                position={[-0.045 + i * 0.032, 0.081, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[0.014, 0.07]} />
                <meshStandardMaterial color={c} roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      }
      // axial through-hole: beige body with 4 colour bands + wire leads
      return (
        <group>
          <mesh
            position={[0, 0.14, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.075, 0.075, 0.32, 16]} />
            <meshStandardMaterial color="#d8c79f" roughness={0.5} />
          </mesh>
          {[b1, b2, b3, BAND.gold].map((c, i) => (
            <mesh
              key={i}
              position={[-0.09 + i * 0.05, 0.14, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.077, 0.077, 0.03, 16]} />
              <meshStandardMaterial color={c} roughness={0.45} />
            </mesh>
          ))}
          {[-0.27, 0.27].map((x) => (
            <mesh
              key={x}
              position={[x, 0.14, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.018, 0.018, 0.2, 8]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    }
    case "fuse":
      return (
        <group>
          {/* yellow-green PTC body */}
          <mesh position={[0, 0.09, 0]} castShadow>
            <boxGeometry args={[0.36, 0.14, 0.24]} />
            <meshStandardMaterial color="#b9bf52" roughness={0.5} />
          </mesh>
          {/* darker underside */}
          <mesh position={[0, 0.025, 0]}>
            <boxGeometry args={[0.36, 0.05, 0.24]} />
            <meshStandardMaterial color="#4a4d24" roughness={0.6} />
          </mesh>
          {/* tinned legs */}
          {[-0.22, 0.22].map((x) => (
            <mesh
              key={x}
              position={[x, 0.04, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    case "reg":
      return (
        <group>
          {/* black epoxy body */}
          <mesh position={[0, 0.09, 0]} castShadow>
            <boxGeometry args={[0.45, 0.12, 0.4]} />
            <meshStandardMaterial color="#1e1e1e" roughness={0.5} />
          </mesh>
          {/* metal tab on the top face */}
          <mesh position={[0, 0.16, -0.04]} castShadow>
            <boxGeometry args={[0.42, 0.025, 0.28]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
          {/* three legs on the front edge */}
          {[-0.14, 0, 0.14].map((x) => (
            <mesh key={x} position={[x, 0.035, 0.2]}>
              <boxGeometry args={[0.05, 0.07, 0.03]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      );
    case "ecap":
      return (
        <group>
          {/* blue PVC sleeve */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.6, 24]} />
            <meshStandardMaterial color="#1c2f6b" roughness={0.35} />
          </mesh>
          {/* white negative stripe */}
          <mesh position={[0, 0.3, 0.185]}>
            <boxGeometry args={[0.03, 0.5, 0.03]} />
            <meshStandardMaterial color="#d8d8d8" roughness={0.4} />
          </mesh>
          {/* aluminium top cap */}
          <mesh position={[0, 0.605, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.01, 24]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
          {/* scored vent cross */}
          <mesh position={[0, 0.611, 0]}>
            <boxGeometry args={[0.28, 0.004, 0.02]} />
            <meshStandardMaterial color="#6f6f6f" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.611, 0]}>
            <boxGeometry args={[0.02, 0.004, 0.28]} />
            <meshStandardMaterial color="#6f6f6f" roughness={0.6} />
          </mesh>
        </group>
      );
    case "led":
      if (!part.smd) {
        // through-hole 5 mm LED: epoxy dome + flange + long wire leads
        const ledE = lit ? 3.5 * energy : 0.08;
        return (
          <group>
            {/* dome lens */}
            <mesh position={[0, 0.16, 0]} castShadow>
              <sphereGeometry args={[0.14, 20, 16]} />
              <meshStandardMaterial
                color={part.color ?? "#ff4136"}
                transparent
                opacity={0.85}
                roughness={0.2}
                emissive={part.color ?? "#ff4136"}
                emissiveIntensity={ledE}
              />
            </mesh>
            {/* cylindrical body below the dome */}
            <mesh position={[0, 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.135, 0.135, 0.16, 20]} />
              <meshStandardMaterial
                color={part.color ?? "#ff4136"}
                transparent
                opacity={0.85}
                roughness={0.25}
                emissive={part.color ?? "#ff4136"}
                emissiveIntensity={ledE}
              />
            </mesh>
            {/* flange ring */}
            <mesh position={[0, 0.035, 0]}>
              <cylinderGeometry args={[0.185, 0.185, 0.05, 20]} />
              <meshStandardMaterial
                color={part.color ?? "#ff4136"}
                transparent
                opacity={0.9}
                roughness={0.35}
              />
            </mesh>
            {/* wire leads (anode longer) */}
            {[
              [-0.07, 0.16],
              [0.07, 0.13],
            ].map(([x, h], i) => (
              <mesh key={i} position={[x, h / 2, 0]}>
                <cylinderGeometry args={[0.016, 0.016, h, 8]} />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.9}
                  roughness={0.3}
                />
              </mesh>
            ))}
            {lit && (
              <pointLight
                position={[0, 0.35, 0]}
                distance={1.6 * energy + 0.4}
                intensity={5 * energy}
                color={part.color ?? "#ff4136"}
              />
            )}
          </group>
        );
      }
      return (
        <group>
          {/* white ceramic body */}
          <mesh position={[0, 0.04, 0]} castShadow>
            <boxGeometry args={[0.16, 0.08, 0.1]} />
            <meshStandardMaterial color="#ece6d4" roughness={0.5} />
          </mesh>
          {/* nickel pads */}
          {[-0.065, 0.065].map((x) => (
            <mesh key={x} position={[x, 0.045, 0]}>
              <boxGeometry args={[0.035, 0.09, 0.11]} />
              <meshStandardMaterial
                color={metal}
                metalness={0.9}
                roughness={0.3}
              />
            </mesh>
          ))}
          {/* light-emitting lens */}
          <mesh position={[0, 0.095, 0]}>
            <boxGeometry args={[0.09, 0.03, 0.06]} />
            <meshStandardMaterial
              color={lit ? "#ffffff" : "#d8d2c0"}
              emissive={part.color ?? "#ffffff"}
              emissiveIntensity={lit ? 3 : 0.05}
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
      // ESP32-S3-WROOM-1: matte-black castellated carrier PCB, brushed-silver
      // RF shield, and the exposed copper meander antenna on the edge-facing
      // end, sitting inside the copper-free keep-out zone.
      return (
        <group>
          {/* module PCB (matte black, 1.9 × 1.5 castellated carrier) */}
          <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.9, 0.08, 1.5]} />
            <meshStandardMaterial color="#151515" roughness={0.55} />
          </mesh>
          {/* brushed silver RF shield over the radio + flash die */}
          <mesh position={[-0.28, 0.17, 0]} castShadow>
            <boxGeometry args={[1.15, 0.18, 1.28]} />
            <meshStandardMaterial
              color="#cfd3d8"
              metalness={0.92}
              roughness={0.24}
            />
          </mesh>
          {/* shield lid highlight (brushed sheen) */}
          <mesh position={[-0.28, 0.262, 0]}>
            <boxGeometry args={[0.85, 0.01, 0.9]} />
            <meshStandardMaterial
              color="#b8bcbf"
              metalness={0.9}
              roughness={0.35}
            />
          </mesh>
          {/* shield seam frame */}
          <mesh position={[-0.28, 0.265, 0]}>
            <boxGeometry args={[1.05, 0.006, 1.18]} />
            <meshStandardMaterial
              color="#8f9498"
              metalness={0.85}
              roughness={0.4}
            />
          </mesh>
          {/* exposed copper meander antenna (copper-free section, edge end) */}
          <mesh position={[0.88, 0.085, 0]}>
            <boxGeometry args={[0.02, 0.006, 1.2]} />
            <meshStandardMaterial
              color="#d9b45a"
              metalness={1}
              roughness={0.2}
            />
          </mesh>
          {[-0.45, -0.15, 0.15, 0.45].map((z) => (
            <mesh key={z} position={[0.78, 0.085, z]}>
              <boxGeometry args={[0.2, 0.006, 0.02]} />
              <meshStandardMaterial
                color="#d9b45a"
                metalness={1}
                roughness={0.2}
              />
            </mesh>
          ))}
          {/* antenna feed from the shield edge into the meander */}
          {[-0.55, 0.55].map((z) => (
            <mesh key={z} position={[0.78, 0.085, z]}>
              <boxGeometry args={[0.22, 0.006, 0.02]} />
              <meshStandardMaterial
                color="#d9b45a"
                metalness={1}
                roughness={0.2}
              />
            </mesh>
          ))}
          {/* castellated pads along both long edges (align to the headers) */}
          {[-0.68, 0.68].map((z) => (
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
              <mesh key={i} position={[0, 0.2, (i - 2) * 0.09]} castShadow>
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
              <mesh key={i} position={[(i - 2) * 0.075, 0.12, 0]} castShadow>
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
            <meshStandardMaterial
              color="#a8adb1"
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.26, 20]} />
            <meshStandardMaterial
              color="#cfcfcf"
              metalness={0.95}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0.045, 0.57, 0]}>
            <boxGeometry args={[0.03, 0.2, 0.08]} />
            <meshStandardMaterial
              color="#b8b8b8"
              metalness={0.95}
              roughness={0.2}
            />
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
                  <meshBasicMaterial
                    color="#c9ffff"
                    transparent
                    opacity={0.55}
                  />
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

/** Charred-carbon finish the damaged part transitions to (Stage 2). */
const CHAR_COLOR = new THREE.Color("#181414");
/** Inner ember glow colour that fades as the husk cools. */
const EMBER_COLOR = new THREE.Color("#ff3b00");

/** Pristine material finish snapshotted into mesh.userData.origMaterial. */
type OrigFinish = {
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
};

/** First material of a mesh (every part mesh here is single-material). */
const firstMaterial = (mesh: THREE.Mesh) =>
  (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
    | THREE.Material
    | undefined;

/**
 * Snapshot every descendant MeshStandardMaterial's pristine finish into
 * mesh.userData.origMaterial. Called once on first mount — BEFORE any burnout
 * charring can mutate the materials — so Repair / Reset Fault / Strip to bare
 * PCB can always restore the original look.
 */
function snapshotFinishes(root: THREE.Object3D | null) {
  if (!root) return;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.origMaterial) return;
    const m = firstMaterial(mesh);
    if (m instanceof THREE.MeshStandardMaterial) {
      const orig: OrigFinish = {
        color: m.color.clone(),
        emissive: m.emissive.clone(),
        emissiveIntensity: m.emissiveIntensity,
        roughness: m.roughness,
        metalness: m.metalness,
      };
      mesh.userData.origMaterial = orig;
    }
  });
}

/**
 * Copy every snapshotted pristine finish back onto its material — the
 * damaged→undamaged transition that clears the burnout red tint. (Scorch
 * decal / sparks / smoke live in Viewport3D's FaultOverlay, which unmounts
 * with the fault.)
 */
function restoreFinishes(root: THREE.Object3D | null) {
  if (!root) return;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const orig = mesh.userData.origMaterial as OrigFinish | undefined;
    const m = firstMaterial(mesh);
    if (!orig || !(m instanceof THREE.MeshStandardMaterial)) return;
    m.color.copy(orig.color);
    m.emissive.copy(orig.emissive);
    m.emissiveIntensity = orig.emissiveIntensity;
    m.roughness = orig.roughness;
    m.metalness = orig.metalness;
  });
}

export function AnimatedPart({
  part,
  placed,
  explode,
  lit,
  energy = 1,
  charred = false,
  damagedPartId,
  faultPartId,
  onHover,
}: {
  part: Part;
  placed: boolean;
  explode: number;
  lit: boolean;
  /** Output-energy factor 0..1 forwarded to the part geometry. */
  energy?: number;
  /** Stage 2 of the failure sequence: the part scorches to matte carbon. */
  charred?: boolean;
  /** Fault-owner part id + [x, z] coords, forwarded to the part geometry. */
  damagedPartId?: string;
  faultPartId?: [number, number];
  onHover: (s: string | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const layer = part.smd ? 1 : part.kind === "hdr" ? 3 : 2;
  // charring state (pure refs — no per-frame state updates)
  const wasDamaged = useRef(false);
  const charT = useRef(0);
  /** Materials being charred in useFrame (gathered once per burnout). */
  const charMats = useRef<THREE.MeshStandardMaterial[] | null>(null);

  // Snapshot the pristine finishes once, on first mount, into
  // mesh.userData.origMaterial — the restore source for every later repair.
  useEffect(() => {
    snapshotFinishes(ref.current);
  }, []);

  // isDamaged (charred) true → false — Repair / Reset Fault / Strip to bare
  // PCB: explicitly put the pristine finish back so no red burn tint survives.
  useEffect(() => {
    if (charred) {
      wasDamaged.current = true;
      return;
    }
    if (!wasDamaged.current) return;
    wasDamaged.current = false;
    charMats.current = null;
    restoreFinishes(ref.current);
  }, [charred]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const ty = placed ? PCB_T / 2 + explode * layer * 1.1 : 7;
    const k = 1 - Math.exp(-dt * (placed ? 7 : 4));
    g.position.y += (ty - g.position.y) * k;
    const s = placed ? 1 : 0.001;
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k);
    g.rotation.y += ((placed ? 0 : 2) - g.rotation.y) * k;

    /* ---- Stage 2 · component charring + fading inner ember ---- */
    if (charred) {
      if (!charMats.current) {
        const mats: THREE.MeshStandardMaterial[] = [];
        g.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const m = firstMaterial(mesh);
          if (m instanceof THREE.MeshStandardMaterial) mats.push(m);
        });
        charMats.current = mats;
      }
      charT.current += dt;
      const t = charT.current;
      // fast scorch: lerp every finish toward matte carbon (~0.3s)
      const kk = 1 - Math.exp(-dt * 9);
      // ember glow decays over ~1.6s with a hot flicker, then dies out
      const ember =
        Math.max(0, 2.2 * Math.exp(-t * 1.6)) * (0.8 + Math.sin(t * 23) * 0.2);
      charMats.current.forEach((m) => {
        m.color.lerp(CHAR_COLOR, kk);
        m.emissive.lerp(EMBER_COLOR, kk);
        m.roughness += (1 - m.roughness) * kk;
        m.metalness += (0.05 - m.metalness) * kk;
        m.emissiveIntensity = ember;
      });
    }
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
      <Geo
        part={part}
        lit={lit}
        energy={energy}
        charred={charred}
        damagedPartId={damagedPartId}
        faultPartId={faultPartId}
      />
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

/* ------------------------------------------------------------------ */
/*  Procedural industrial PCB texture (copper, ENIG pads, silkscreen)  */
/* ------------------------------------------------------------------ */

export const DEFAULT_PIN_LABELS: string[] = [
  "GND",
  "5V",
  "3V3",
  "TX",
  "RX",
  "SDA",
  "SCL",
  ...Array.from({ length: 14 }, (_, i) => `D${i}`),
  ...Array.from({ length: 6 }, (_, i) => `A${i}`),
];

/** Header silkscreen for the Arduino Uno R3 (matches the physical pin order). */
export const UNO_PIN_LABELS: string[] = [
  ...Array.from({ length: 14 }, (_, i) => `D${i}`),
  "GND",
  "AREF",
  "IOREF",
  "RESET",
  "3V3",
  "5V",
  "GND",
  "GND",
  "VIN",
  ...Array.from({ length: 6 }, (_, i) => `A${i}`),
];

const TEX = 1024;

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PcbLayer = "color" | "rough";

type SilkCtx = {
  U: number;
  H: number;
  silk: (a?: number) => string;
  setFont: (px: number, weight?: string) => void;
  text: (
    s: string,
    x: number,
    y: number,
    px: number,
    o?: { align?: CanvasTextAlign; rot?: number; weight?: string },
  ) => void;
  box: (x: number, y: number, w: number, h: number) => void;
  dot: (x: number, y: number, r?: number) => void;
  tick: (x0: number, y0: number, x1: number, y1: number) => void;
};

/**
 * Authentic Arduino Uno R3 silkscreen: edge titles, white placement outlines
 * at the real part positions, reference designators, board title and logo.
 * Board units map through X()/Z() exactly like the ENIG mounting-hole pads.
 */
function paintUnoSilk(ctx: CanvasRenderingContext2D, h: SilkCtx) {
  const { U, H, silk, text, box, dot, tick } = h;
  const TAU = Math.PI * 2;
  const u = U / 6.9; // canvas px per board unit
  const X = (x: number) => (x / 6.9 + 0.5) * U;
  const Z = (z: number) => (0.5 + z / 5.3) * H;

  ctx.strokeStyle = silk();
  ctx.fillStyle = silk();
  ctx.lineJoin = "miter";

  // ── header rows: outline + one dot per pin ──
  const hdrRow = (cx: number, cz: number, n: number, vertical = false) => {
    const len = n * 0.25 * u;
    const x = X(cx);
    const y = Z(cz);
    box(x, y, vertical ? 0.36 * u : len, vertical ? len : 0.36 * u);
    for (let i = 0; i < n; i++) {
      const o = -((n - 1) * 0.25 * u) / 2 + i * 0.25 * u;
      if (vertical) dot(x, y + o, 4.5);
      else dot(x + o, y, 4.5);
    }
  };
  hdrRow(2.0, 2.4, 8); // digital 0-7
  hdrRow(-0.4, 2.4, 10); // digital 8-13
  hdrRow(-0.2, -2.4, 8); // power
  hdrRow(2.0, -2.4, 6); // analog in
  hdrRow(-1.6, 1.9, 3); // ICSP2 (16U2)

  // ICSP 2x3 block
  {
    const x = X(3.1);
    const y = Z(-0.2);
    box(x, y, 0.44 * u, 0.9 * u);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 2; c++)
        dot(x + (c - 0.5) * 0.25 * u, y + (r - 1) * 0.25 * u, 4.5);
    text("ICSP", x, Z(-1.0), 22, { weight: "700" });
  }

  // ── edge titles ──
  text("DIGITAL (PWM ~)", X(0.55), Z(2.0), 30, { weight: "800" });
  text("POWER", X(-0.9), Z(-2.0), 30, { weight: "800" });
  text("ANALOG IN", X(2.05), Z(-2.0), 30, { weight: "800" });

  // ── big connectors ──
  box(X(-3.05), Z(1.4), 1.66 * u, 1.26 * u);
  text("USB-B", X(-3.05), Z(0.62), 22, { weight: "700" });
  box(X(-3.0), Z(-1.8), 1.46 * u, 1.0 * u);
  text("DC IN", X(-3.0), Z(-1.15), 22, { weight: "700" });

  // ── reset button ──
  box(X(-2.6), Z(2.1), 0.66 * u, 0.66 * u);
  ctx.beginPath();
  ctx.arc(X(-2.6), Z(2.1), 0.17 * u, 0, TAU);
  ctx.stroke();
  text("RESET", X(-2.6), Z(1.5), 22, { weight: "700" });

  // ── small parts: polyfuse, regulator, electrolytics, MLCCs, resistors ──
  box(X(-2.6), Z(0.5), 0.42 * u, 0.28 * u); // polyfuse
  text("F1", X(-2.6), Z(0.1), 22, { weight: "800" });

  box(X(-2.2), Z(-1.3), 0.5 * u, 0.46 * u); // regulator
  text("U2", X(-2.2), Z(-0.95), 22, { weight: "800" });

  (
    [
      [-2.1, "C5"],
      [-1.6, "C6"],
    ] as [number, string][]
  ).forEach(([x, l]) => {
    ctx.beginPath();
    ctx.arc(X(x), Z(-0.5), 0.24 * u, 0, TAU);
    ctx.stroke();
    text(l, X(x), Z(-0.9), 20, { weight: "800" });
  });

  (
    [
      [0.3, 0.3, "C1"],
      [-0.6, -0.1, "C2"],
    ] as [number, number, string][]
  ).forEach(([x, z, l]) => {
    box(X(x), Z(z), 0.3 * u, 0.2 * u);
    text(l, X(x), Z(z + 0.26), 18);
  });

  (
    [
      [-0.5, 1.5, "R1"],
      [1.2, 0.5, "R2"],
    ] as [number, number, string][]
  ).forEach(([x, z, l]) => {
    box(X(x), Z(z), 0.4 * u, 0.2 * u);
    text(l, X(x), Z(z + 0.24), 18);
  });

  // ── LED legends ──
  (
    [
      [1.6, 0.9],
      [-0.9, 1.5],
      [-0.9, 1.05],
      [-0.9, 1.25],
    ] as [number, number][]
  ).forEach(([x, z]) => box(X(x), Z(z), 0.26 * u, 0.18 * u));
  text("ON", X(1.6), Z(0.5), 20, { weight: "800" });
  text("L", X(-1.2), Z(1.5), 20, { weight: "800" });
  text("TX", X(-1.25), Z(1.05), 15, { weight: "700" });
  text("RX", X(-1.25), Z(1.25), 15, { weight: "700" });

  // ── crystal ──
  ctx.beginPath();
  ctx.ellipse(X(-0.35), Z(-0.5), 0.28 * u, 0.15 * u, 0, 0, TAU);
  ctx.stroke();
  text("Y1 16MHz", X(-1.05), Z(-0.5), 18, { weight: "700" });

  // ── ATmega328P DIP-28 outline ──
  {
    const x = X(1.0);
    const y = Z(-1.0);
    box(x, y, 2.7 * u, 0.85 * u);
    for (let i = 0; i < 14; i++) {
      const tx = x - 1.175 * u + (i * 2.35 * u) / 13;
      tick(tx, y - 0.425 * u, tx, y - 0.55 * u);
      tick(tx, y + 0.425 * u, tx, y + 0.55 * u);
    }
    // index notch on the left end
    ctx.beginPath();
    ctx.arc(x - 1.35 * u, y, 0.11 * u, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    text("U3 · ATmega328P", x, y, 24, { weight: "800" });
  }

  // ── ATmega16U2 TQFP-32 outline ──
  {
    const x = X(-1.6);
    const y = Z(0.4);
    box(x, y, 0.72 * u, 0.72 * u);
    for (let i = 0; i < 8; i++) {
      const t = -0.28 * u + (i * 0.56 * u) / 7;
      tick(x + t, y - 0.36 * u, x + t, y - 0.44 * u);
      tick(x + t, y + 0.36 * u, x + t, y + 0.44 * u);
      tick(x - 0.36 * u, y + t, x - 0.44 * u, y + t);
      tick(x + 0.36 * u, y + t, x + 0.44 * u, y + t);
    }
    dot(x - 0.26 * u, y - 0.26 * u, 5);
    text("U1", x, y, 22, { weight: "800" });
  }

  // ── Arduino infinity logo + board title ──
  {
    const ly = Z(-0.3);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(X(0.28), ly, 0.17 * u, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(0.62), ly, 0.17 * u, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    tick(X(0.28) - 7, ly, X(0.28) + 7, ly);
    tick(X(0.28), ly - 7, X(0.28), ly + 7);
    tick(X(0.62) - 7, ly, X(0.62) + 7, ly);
    text("ARDUINO UNO", X(1.55), ly, 32, { weight: "800" });
    text("ROBOTICS BENCH · REV3 · 2026", X(1.55), Z(-0.02), 18, {
      weight: "700",
    });
  }
  text("CE", X(3.2), Z(-2.1), 24, { weight: "800" });
  text("RoHS", X(3.2), Z(-1.78), 17, { weight: "700" });
}

/* ------------------------------------------------------------------ */
/*  Board-style top surfaces (Fig. 02–05), painted instead of the      */
/*  generic FR-4 artwork when the board name matches a style.          */
/* ------------------------------------------------------------------ */

type BoardStyleName = "breadboard" | "perfboard" | "devkit-narrow" | "hc-sr04";

/** Board dimensions (units) and base mask colour per style. */
export const STYLE_DIMS: Record<BoardStyleName, [number, number]> = {
  breadboard: [4.7, 3.5],
  perfboard: [5.2, 3.8],
  "devkit-narrow": [6.2, 2.5],
  "hc-sr04": [4.5, 2.0],
};

const STYLE_MASK: Record<BoardStyleName, string> = {
  breadboard: "#f0ede2",
  perfboard: "#a06a35",
  "devkit-narrow": "#16181a",
  "hc-sr04": "#1450a0",
};

/** Maps a board name to its physical style (Uno falls through to null). */
export function boardStyleOf(title?: string): BoardStyleName | null {
  if (!title) return null;
  if (/LED \+ resistor/i.test(title)) return "breadboard";
  if (/Transistor/i.test(title)) return "perfboard";
  if (/ESP32/i.test(title)) return "devkit-narrow";
  if (/Ultrasonic|HC-SR04/i.test(title)) return "hc-sr04";
  return null;
}

type StyleCtx = {
  layer: PcbLayer;
  U: number;
  H: number;
  col: (hex: string, rough: number, a?: number) => string;
  rng: () => number;
  X: (x: number) => number;
  Z: (z: number) => number;
};

type StylePainter = (ctx: CanvasRenderingContext2D, t: StyleCtx) => void;

const paintStyleSurface: Record<BoardStyleName, StylePainter> = {
  /* ---- Fig. 02 · 170-point solderless breadboard ---- */
  breadboard: (ctx, t) => {
    const { U, H, col, X, Z, rng } = t;
    // cream ABS body with fine moulded grain
    ctx.fillStyle = col("#f0ede2", 0.62);
    ctx.fillRect(0, 0, U, H);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle =
        rng() < 0.5 ? col("#ffffff", 0.6, 0.06) : col("#b8b2a2", 0.62, 0.05);
      ctx.fillRect(rng() * U, rng() * H, 2, 2);
    }

    // deeper central DIP channel: bevel, shadowed walls and a dark trough
    ctx.fillStyle = col("#d3cebe", 0.5);
    ctx.fillRect(0, Z(-0.25), U, Z(0.25) - Z(-0.25));
    ctx.fillStyle = col("#9a9485", 0.48);
    ctx.fillRect(0, Z(-0.19), U, Z(0.19) - Z(-0.19));
    ctx.fillStyle = col("#5d594f", 0.74);
    ctx.fillRect(0, Z(-0.115), U, Z(0.115) - Z(-0.115));
    ctx.fillStyle = col("#ffffff", 0.55, 0.45);
    ctx.fillRect(0, Z(-0.255), U, 3);
    ctx.fillRect(0, Z(0.25), U, 3);

    /** One recessed square socket: moulded collar, dark mouth, spring clip. */
    const socket = (x: number, z: number) => {
      const px = X(x);
      const pz = Z(z);
      ctx.fillStyle = col("#d8d3c2", 0.5);
      ctx.fillRect(px - 10, pz - 10, 20, 20);
      ctx.fillStyle = col("#24221e", 0.8);
      ctx.fillRect(px - 6.5, pz - 6.5, 13, 13);
      // two tinned spring leaves catching the light inside the hole
      ctx.fillStyle = col("#aeb3b8", 0.3, 0.95);
      ctx.fillRect(px - 4, pz - 4.5, 3, 9);
      ctx.fillRect(px + 1, pz - 4.5, 3, 9);
      ctx.fillStyle = col("#eceff1", 0.28, 0.7);
      ctx.fillRect(px - 4, pz - 4.5, 1.2, 9);
      ctx.fillRect(px + 1, pz - 4.5, 1.2, 9);
    };

    // tie-point grid: 2 banks of 5 rows × 17 columns
    const pitchX = 0.262;
    const x0 = -(16 * pitchX) / 2;
    for (let c = 0; c < 17; c++) {
      for (let r = 0; r < 5; r++) {
        for (const s of [1, -1]) {
          socket(x0 + c * pitchX, s * (0.36 + r * 0.25));
        }
      }
    }

    // power rails: red (+) and blue (−) stripes with their own tie rows
    for (const s of [1, -1]) {
      const zLine = Z(s * 1.44);
      ctx.fillStyle = s > 0 ? col("#c8372a", 0.5) : col("#2a5fc8", 0.5);
      ctx.fillRect(U * 0.04, zLine - 4, U * 0.92, 8);
      // "+" / "−" marks at both rail ends
      ctx.fillStyle = col("#333", 0.6);
      ctx.font = "700 26px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s > 0 ? "+" : "\u2212", X(-2.28), zLine);
      ctx.fillText(s > 0 ? "+" : "\u2212", X(2.28), zLine);
      // rail tie rows (two rows flanking each stripe)
      for (let c = 0; c < 20; c++) {
        for (const dz of [0.17, 0.3]) {
          socket(-2.28 + c * 0.24, s * (1.44 + dz));
        }
      }
    }

    // crisp moulded column numbers 1–17 on both long edges
    ctx.font = "700 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = col("#4a463d", 0.66);
    for (let c = 0; c < 17; c++) {
      const px = X(x0 + c * pitchX);
      ctx.fillText(String(c + 1), px, 17);
      ctx.fillText(String(c + 1), px, H - 17);
    }

    // crisp moulded row letters A–E / F–J down both short edges
    ctx.font = "700 24px Arial";
    for (const side of [-1, 1]) {
      const px = X(side * 2.22);
      for (let r = 0; r < 5; r++) {
        ctx.fillText(String.fromCharCode(65 + r), px, Z(0.36 + r * 0.25));
        ctx.fillText(String.fromCharCode(70 + r), px, Z(-(0.36 + r * 0.25)));
      }
    }

    // molded edge highlights
    ctx.strokeStyle = col("#ffffff", 0.55, 0.5);
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, U - 12, H - 12);
    if (t.layer === "color") {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0.05)");
      g.addColorStop(0.5, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.08)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, U, H);
    }
  },

  /* ---- Fig. 03 · phenolic perfboard with copper pad grid ---- */
  perfboard: (ctx, t) => {
    const { U, H, col, X, Z, rng } = t;
    // tan phenolic (paper FR-2) substrate with fibre grain
    ctx.fillStyle = col("#a06a35", 0.68);
    ctx.fillRect(0, 0, U, H);
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle =
        rng() < 0.5 ? col("#c98d4b", 0.68, 0.08) : col("#5f3c1c", 0.68, 0.07);
      ctx.fillRect(rng() * U, rng() * H, 3, 1.5);
    }
    // copper pad grid on a 0.1" pitch (0.25 units), plated rings + drilled hole
    const pitch = 0.25;
    for (let x = -2.35; x <= 2.35; x += pitch) {
      for (let z = -1.6; z <= 1.6; z += pitch) {
        const cx = X(x);
        const cy = Z(z);
        ctx.beginPath();
        ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
        ctx.fillStyle = col("#b87333", 0.36);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = col("#171008", 0.85);
        ctx.fill();
      }
    }
    // a few hand-soldered copper links between neighbouring pads
    const links: [number, number][] = [
      [-1.1, 0.85],
      [0.15, -0.85],
      [-0.35, 1.35],
      [1.35, -0.35],
    ];
    ctx.strokeStyle = col("#b87333", 0.36, 0.9);
    ctx.lineWidth = 7;
    links.forEach(([x, z]) => {
      ctx.beginPath();
      ctx.moveTo(X(x), Z(z));
      ctx.lineTo(X(x + pitch), Z(z));
      ctx.stroke();
    });
    // slight edge wear
    ctx.strokeStyle = col("#5f3c1c", 0.7, 0.6);
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, U - 8, H - 8);
  },

  /* ---- Fig. 04 · matte-black ESP32-S3 DevKitC-1 ---- */
  "devkit-narrow": (ctx, t) => {
    const { U, H, col, X, Z, rng } = t;
    // matte black soldermask with faint weave
    ctx.fillStyle = col("#16181a", 0.42);
    ctx.fillRect(0, 0, U, H);
    for (let i = 0; i < 10000; i++) {
      ctx.fillStyle =
        rng() < 0.5 ? col("#2a2e33", 0.42, 0.05) : col("#000000", 0.42, 0.06);
      ctx.fillRect(rng() * U, rng() * H, 1.5, 1.5);
    }
    // faint ghost traces under the black mask
    ctx.strokeStyle = col("#8a97a5", 0.42, 0.1);
    ctx.lineWidth = 3;
    for (let i = 0; i < 22; i++) {
      const y = 90 + rng() * (H - 180);
      ctx.beginPath();
      ctx.moveTo(60 + rng() * 120, y);
      ctx.bezierCurveTo(
        U * 0.35,
        y + 60 - rng() * 120,
        U * 0.6,
        y + 80 - rng() * 160,
        U - 60 - rng() * 120,
        y + 40 - rng() * 80,
      );
      ctx.stroke();
    }
    // twin 22-pin castellated header pad rows along both long edges
    // (matches the hdr part pins: p.x=-0.1, pitch 0.25 → span -2.725…2.525)
    for (const s of [1, -1]) {
      for (let i = 0; i < 22; i++) {
        const x = X(-2.725 + i * 0.25);
        const y = Z(s * 1.0);
        ctx.fillStyle = col("#d4af37", 0.26);
        ctx.fillRect(x - 9, y - 9, 18, 18);
        ctx.fillStyle = col("#0c0d0e", 0.9);
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
    }
    // silkscreen: title + key designators
    ctx.fillStyle = col("#e8e6df", 0.8);
    ctx.font = "800 40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ESP32-S3-DEVKITC-1", U / 2, H - 60);
    ctx.font = "600 24px Arial";
    ctx.fillText("REV A · 2026 · FCC ID 2AC7Z-ESP32S3", U / 2, H - 30);
    ctx.font = "700 22px Arial";
    ctx.fillText("GND  5V  3V3", X(-2.9), Z(0.35));
    ctx.fillText("EN  GPIO0", X(2.75), Z(-0.35));
  },

  /* ---- Fig. 05 · blue HC-SR04 sonar board ---- */
  "hc-sr04": (ctx, t) => {
    const { U, H, col, X, Z, rng } = t;
    const TAU = Math.PI * 2;
    // classic glossy blue soldermask
    ctx.fillStyle = col("#1450a0", 0.35);
    ctx.fillRect(0, 0, U, H);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle =
        rng() < 0.5 ? col("#3d78c8", 0.35, 0.05) : col("#08245c", 0.35, 0.06);
      ctx.fillRect(rng() * U, rng() * H, 1.5, 1.5);
    }
    // transducer footprints: big gold rings, front edge (x ≈ 1.7)
    for (const s of [1, -1]) {
      const cx = X(1.7);
      const cy = Z(s * 0.85);
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, TAU);
      ctx.fillStyle = col("#d4af37", 0.26);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, TAU);
      ctx.fillStyle = col("#08245c", 0.9);
      ctx.fill();
      // escape traces from each ring toward the driver ICs
      ctx.strokeStyle = col("#d4af37", 0.26, 0.7);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 46, cy);
      ctx.lineTo(X(-0.1), cy + (s > 0 ? -30 : 30));
      ctx.stroke();
    }
    // 4-pin right-angle header pads at the rear edge
    // (matches the h1 part: n=4, pitch 0.25, centred on z=0)
    for (let i = 0; i < 4; i++) {
      const x = X(-1.95);
      const y = Z(-0.375 + i * 0.25);
      ctx.fillStyle = col("#d4af37", 0.26);
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = col("#08245c", 0.9);
      ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
    }
    // silkscreen
    ctx.strokeStyle = col("#f3f0e6", 0.8);
    ctx.fillStyle = col("#f3f0e6", 0.8);
    ctx.font = "800 46px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("HC-SR04", X(-0.55), Z(0.0));
    ctx.font = "700 26px Arial";
    ctx.fillText("T", X(1.7), Z(1.42));
    ctx.fillText("R", X(1.7), Z(-1.42));
    ctx.font = "600 20px Arial";
    ctx.fillText("VCC TRIG ECHO GND", X(-0.62), Z(-0.92));
    ctx.font = "600 22px Arial";
    ctx.fillText("5V DC · 2cm – 400cm", X(-0.62), Z(0.95));
  },
};

/**
 * Paints one layer of the board. "color" is the albedo map, "rough" is a
 * grayscale roughness map (read from the green channel by three.js) built from
 * the same drawing calls: gold is glossy, soldermask is satin, silkscreen ink
 * is matte.
 *
 * Canvas layout: canvas top = board -Z edge, canvas right = board +X edge, so the
 * texture reads correctly when the board is viewed from above. The canvas is
 * square but boards are not, so everything is drawn through ctx.scale(1, k) to
 * keep circles round and text undistorted once mapped onto the board.
 */
function paintPcb(
  ctx: CanvasRenderingContext2D,
  layer: PcbLayer,
  maskHex: string,
  title: string,
  labels: string[],
  size: [number, number],
  uno = false,
) {
  const U = TEX;
  const k = size[0] / size[1];
  const H = U / k;
  const TAU = Math.PI * 2;
  const rng = mulberry32(hashStr(`${title}|${maskHex}`));

  const col = (hex: string, rough: number, a = 1) => {
    if (layer === "rough") {
      const v = Math.round(rough * 255);
      return `rgba(${v},${v},${v},${a})`;
    }
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // Board-unit → canvas mapping (canvas is square, painted via ctx.scale).
  // X(x)/Z(z) place content at board coordinates; Z follows the UV mapping in
  // <Pcb/> (uv.y = 0.5 - z/d with flipY upload ⇒ canvas top row ↔ +z edge).
  const X = (x: number) => (x / size[0] + 0.5) * U;
  const Z = (z: number) => (0.5 + z / size[1]) * H;

  // Non-Uno board styles paint their own top surface and skip the generic
  // PCB artwork below (trace routing, ENIG holes, Uno-style silkscreen).
  const style = boardStyleOf(title);
  if (style) {
    ctx.save();
    ctx.scale(1, k);
    paintStyleSurface[style](ctx, { layer, U, H, col, rng, X, Z });
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.scale(1, k);

  /* ---- soldermask base, fibre-weave noise, vignette ---- */
  ctx.fillStyle = col(maskHex, 0.55);
  ctx.fillRect(0, 0, U, H);
  for (let i = 0; i < 14000; i++) {
    ctx.fillStyle =
      rng() < 0.5 ? col("#ffffff", 0.6, 0.025) : col("#000000", 0.5, 0.04);
    ctx.fillRect(rng() * U, rng() * H, 1.5, 1.5);
  }
  if (layer === "color") {
    const g = ctx.createRadialGradient(
      U / 2,
      H / 2,
      U * 0.25,
      U / 2,
      H / 2,
      U * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, U, H);
  }

  /* ---- hatched ground pour ---- */
  {
    const px = U * 0.56;
    const py = H * 0.5;
    const pw = U * 0.38;
    const ph = H * 0.22;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    ctx.strokeStyle = col("#ffffff", 0.42, 0.07);
    ctx.lineWidth = 2;
    for (let d = -ph; d < pw; d += 12) {
      ctx.beginPath();
      ctx.moveTo(px + d, py + ph);
      ctx.lineTo(px + d + ph, py);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = col("#ffffff", 0.42, 0.12);
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, pw, ph);
  }

  /* ---- pin rows (positions first so traces can escape from them) ---- */
  // On the Uno the canvas-top row maps to the power/analog edge, so the
  // digital row paints along the opposite edge instead.
  const isDigital = (l: string) => /^D\d+$/i.test(l) !== uno;
  let topLabels = labels.filter(isDigital);
  let botLabels = labels.filter((l) => !isDigital(l));
  if (!topLabels.length || !botLabels.length) {
    const half = Math.ceil(labels.length / 2);
    topLabels = labels.slice(0, half);
    botLabels = labels.slice(half);
  }
  const margin = 110;
  const PAD_O = 13;
  const PAD_I = 6;
  const topY = 62;
  const botY = H - 62;
  type Pin = {
    x: number;
    y: number;
    label: string;
    top: boolean;
    pitch: number;
  };
  const pins: Pin[] = [];
  const layRow = (items: string[], y: number, top: boolean) => {
    const pitch = (U - 2 * margin) / Math.max(items.length, 1);
    items.forEach((label, i) =>
      pins.push({ x: margin + (i + 0.5) * pitch, y, label, top, pitch }),
    );
  };
  layRow(topLabels, topY, true);
  layRow(botLabels, botY, false);

  /* ---- routed copper traces (under the mask, so only a faint relief) ---- */
  const route = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    diagFirst = false,
  ): [number, number][] => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const sx = Math.sign(dx) || 1;
    const sy = Math.sign(dy) || 1;
    const m = Math.min(adx, ady);
    if (diagFirst)
      return [
        [x0, y0],
        [x0 + sx * m, y0 + sy * m],
        [x1, y1],
      ];
    if (adx > ady)
      return [
        [x0, y0],
        [x1 - sx * m, y0],
        [x1, y1],
      ];
    return [
      [x0, y0],
      [x0, y1 - sy * m],
      [x1, y1],
    ];
  };
  const strokeTrace = (pts: [number, number][], w: number) => {
    const path = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = w;
    ctx.strokeStyle = col("#ffffff", 0.4, 0.12);
    path();
    ctx.stroke();
    // raised highlight (upper-left edge) and shadow (lower-right edge)
    ctx.save();
    ctx.translate(-w * 0.28, -w * 0.28);
    ctx.lineWidth = Math.max(1, w * 0.3);
    ctx.strokeStyle = col("#ffffff", 0.35, 0.16);
    path();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(w * 0.34, w * 0.34);
    ctx.lineWidth = Math.max(1, w * 0.3);
    ctx.strokeStyle = col("#000000", 0.5, 0.2);
    path();
    ctx.stroke();
    ctx.restore();
  };
  const via = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, TAU);
    ctx.fillStyle = col("#ffffff", 0.35, 0.16);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, TAU);
    ctx.fillStyle = col("#000000", 0.9, 0.5);
    ctx.fill();
  };

  // escape routing from every header pad toward the board interior
  pins.forEach((p) => {
    const dir = p.top ? 1 : -1;
    const ty = p.top ? 150 + rng() * 110 : H - 150 - rng() * 110;
    const tx = Math.min(U - 80, Math.max(80, p.x + (rng() - 0.5) * 140));
    const pts = route(p.x, p.y + dir * PAD_O, tx, ty, rng() < 0.5);
    strokeTrace(pts, 4);
    via(tx, ty);
  });
  // general interconnect between random points
  for (let i = 0; i < 26; i++) {
    const x0 = 90 + rng() * (U - 180);
    const y0 = 140 + rng() * (H - 280);
    const x1 = Math.min(U - 70, Math.max(70, x0 + (rng() - 0.5) * 520));
    const y1 = Math.min(H - 130, Math.max(130, y0 + (rng() - 0.5) * 260));
    strokeTrace(route(x0, y0, x1, y1, rng() < 0.4), rng() < 0.3 ? 6 : 4);
    if (rng() < 0.6) via(x1, y1);
  }
  // parallel data buses
  for (let b = 0; b < 3; b++) {
    const bx = 160 + rng() * (U - 480);
    const by = 200 + rng() * (H - 480);
    for (let i = 0; i < 8; i++) {
      strokeTrace(route(bx, by + i * 11, bx + 230, by + i * 11 + 70, false), 3);
    }
  }

  /* ---- ENIG gold pads ---- */
  const pad = (x: number, y: number, ro: number, ri: number) => {
    ctx.beginPath();
    ctx.arc(x, y, ro + 1.5, 0, TAU);
    ctx.fillStyle = col("#000000", 0.5, 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, ro, 0, TAU);
    ctx.fillStyle = col("#d4af37", 0.26);
    ctx.fill();
    if (layer === "color") {
      ctx.beginPath();
      ctx.arc(x, y, ro - 1.5, Math.PI * 1.05, Math.PI * 1.6);
      ctx.strokeStyle = "rgba(255,240,170,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, ri, 0, TAU);
    ctx.fillStyle = col("#140d05", 0.9);
    ctx.fill();
  };
  pins.forEach((p) => pad(p.x, p.y, PAD_O, PAD_I));

  const holes: [number, number][] =
    size[0] > 5
      ? (
          [
            [-2.9, 2.3],
            [3.1, 2.3],
            [3.1, -2.3],
            [-1.9, -2.3],
          ] as [number, number][]
        ).map(([x, z]): [number, number] => [X(x), Z(z)])
      : (
          [
            [0.1, 0.14],
            [0.9, 0.14],
            [0.9, 0.86],
            [0.1, 0.86],
          ] as [number, number][]
        ).map(([a, b]): [number, number] => [a * U, b * H]);
  holes.forEach(([x, y]) => pad(x, y, 30, 17));

  // ICSP 2x3 header pads
  const icsp = { x: U * 0.9, y: 215 };
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 2; c++)
      pad(icsp.x + (c - 0.5) * 30, icsp.y + (r - 1) * 30, 9, 4);

  // fiducials (bare copper dots with mask opening)
  [
    [46, 46],
    [U - 46, 46],
    [U - 46, H - 46],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, TAU);
    ctx.fillStyle = col("#000000", 0.5, 0.18);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, TAU);
    ctx.fillStyle = col("#d4af37", 0.3);
    ctx.fill();
  });

  /* ---- white silkscreen ---- */
  const SILK = "#f3f0e6";
  const silk = (a = 1) => col(SILK, 0.8, a);
  const setFont = (px: number, weight = "600") => {
    ctx.font = `${weight} ${px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  };
  const text = (
    s: string,
    x: number,
    y: number,
    px: number,
    o: { align?: CanvasTextAlign; rot?: number; weight?: string } = {},
  ) => {
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    setFont(px, o.weight);
    ctx.textAlign = o.align ?? "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = silk();
    ctx.fillText(s, 0, 0);
    ctx.restore();
  };

  ctx.strokeStyle = silk();
  ctx.fillStyle = silk();
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, U - 32, H - 32);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(27, 27, U - 54, H - 54);

  // pin labels
  pins.forEach((p) => {
    const px = Math.min(22, p.pitch * 0.46);
    setFont(px, "700");
    const w = ctx.measureText(p.label).width;
    if (w > p.pitch * 0.92) {
      text(p.label, p.x, p.top ? 84 : H - 84, px, {
        rot: p.top ? Math.PI / 2 : -Math.PI / 2,
        align: "left",
        weight: "700",
      });
    } else {
      text(p.label, p.x, p.top ? 98 : H - 98, px, { weight: "700" });
    }
  });

  // mounting-hole keep-out rings
  ctx.lineWidth = 2.5;
  holes.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, TAU);
    ctx.stroke();
  });

  // component footprints + reference designators
  const box = (x: number, y: number, w: number, h: number) => {
    ctx.lineWidth = 3.5;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  };
  const dot = (x: number, y: number, r = 6) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  const tick = (x0: number, y0: number, x1: number, y1: number) => {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  if (uno) {
    // authentic Arduino Uno R3 silkscreen (shares the silk primitives above)
    paintUnoSilk(ctx, { U, H, silk, setFont, text, box, dot, tick });
  } else {
    const yMin = 170;
    const yMax = H - 300;
    const cs = Math.min(1, (yMax - yMin) / 330);
    const CX = (f: number) => f * U;
    const CY = (f: number) => yMin + f * (yMax - yMin);

    // U1 main IC (QFP outline with pin ticks and pin-1 dot)
    {
      const x = CX(0.5);
      const y = CY(0.45);
      const w = 210 * cs + 40;
      const h = 150 * cs + 20;
      box(x, y, w, h);
      for (let i = 0; i < 12; i++) {
        const tx = x - w / 2 + 14 + (i * (w - 28)) / 11;
        tick(tx, y - h / 2, tx, y - h / 2 - 12);
        tick(tx, y + h / 2, tx, y + h / 2 + 12);
      }
      for (let i = 0; i < 8; i++) {
        const ty = y - h / 2 + 12 + (i * (h - 24)) / 7;
        tick(x - w / 2, ty, x - w / 2 - 12, ty);
        tick(x + w / 2, ty, x + w / 2 + 12, ty);
      }
      dot(x - w / 2 + 18, y - h / 2 + 18);
      text("U1", x, y, 32 * Math.max(cs, 0.8), { weight: "800" });
    }
    // U2 SOIC
    {
      const x = CX(0.22);
      const y = CY(0.28);
      const w = 110 * cs + 20;
      const h = 80 * cs + 14;
      box(x, y, w, h);
      for (let i = 0; i < 4; i++) {
        const tx = x - w / 2 + 14 + (i * (w - 28)) / 3;
        tick(tx, y - h / 2, tx, y - h / 2 - 9);
        tick(tx, y + h / 2, tx, y + h / 2 + 9);
      }
      dot(x - w / 2 + 12, y - h / 2 + 12, 4);
      text("U2", x, y, 24, { weight: "800" });
    }
    // Y1 crystal
    {
      const x = CX(0.74);
      const y = CY(0.2);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 52, 24 * Math.max(cs, 0.8), 0, 0, TAU);
      ctx.stroke();
      text("Y1", x, y, 22, { weight: "800" });
    }
    // C1 / C2
    [
      { f: 0.64, l: "C1", pol: true },
      { f: 0.74, l: "C2", pol: false },
    ].forEach(({ f, l, pol }) => {
      const x = CX(f);
      const y = CY(0.62);
      box(x, y, 50, 28 * Math.max(cs, 0.8));
      if (pol) text("+", x - 36, y, 22, { weight: "800" });
      text(l, x, y + 30, 20);
    });
    // R1..R3
    [0.3, 0.4, 0.5].forEach((f, i) => {
      const x = CX(f);
      const y = CY(0.8);
      box(x, y, 54, 24 * Math.max(cs, 0.8));
      text(`R${i + 1}`, x, y + 28, 20);
    });
    // LED1 (diode symbol)
    {
      const x = CX(0.62);
      const y = CY(0.84);
      box(x, y, 54, 24 * Math.max(cs, 0.8));
      tick(x + 12, y - 12, x + 12, y + 12);
      text("LED1", x, y + 28, 20);
    }
    // J1 USB connector outline
    {
      const x = CX(0.075);
      const y = CY(0.38);
      box(x, y, 120, 170 * cs + 30);
      text("J1", x, y - 8, 28, { weight: "800" });
      text("USB", x, y + 22, 20);
    }
    // J2 DC jack outline
    {
      const x = CX(0.08);
      const y = CY(0.88);
      box(x, y, 120, 100 * cs + 30);
      text("J2", x, y - 8, 26, { weight: "800" });
      text("DC IN", x, y + 20, 18);
    }
    // SW1 reset button
    {
      const x = CX(0.9);
      const y = CY(0.66);
      box(x, y, 62, 62);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, TAU);
      ctx.stroke();
      text("SW1", x, y + 48, 20);
      text("RST", x, y + 68, 16);
    }
    // ICSP outline
    box(icsp.x, icsp.y, 84, 118);
    dot(icsp.x - 15, icsp.y - 52, 4);
    text("ICSP", icsp.x, icsp.y + 76, 18, { weight: "700" });

    // board title, revision and compliance marks
    {
      let tpx = 46;
      setFont(tpx, "800");
      const upper = title.toUpperCase();
      while (ctx.measureText(upper).width > U * 0.62 && tpx > 20) {
        tpx -= 2;
        setFont(tpx, "800");
      }
      const ty = H - 250;
      text(upper, U / 2, ty, tpx, { weight: "800" });
      ctx.fillRect(U * 0.2, ty + tpx * 0.72, U * 0.6, 3);
      text(
        "ROBOTICS BENCH  \u00B7  REV A  \u00B7  2026",
        U / 2,
        ty + tpx * 1.35,
        20,
      );
      text("CE", U * 0.86, H - 200, 26, { weight: "800" });
      text("RoHS", U * 0.86, H - 170, 17, { weight: "700" });
    }
  }

  ctx.restore();
}

/**
 * Builds the PCB albedo map and a matching roughness map from an offscreen
 * 1024x1024 canvas. Use as `map` and `roughnessMap` on the board material
 * (with roughness={1}).
 */

export function createPcbTexture(
  colorHex: string,
  boardName: string,
  pinLabels: string[] = DEFAULT_PIN_LABELS,
  size: [number, number] = [6.9, 5.3],
  uno = false,
): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  // normalise any CSS colour (name, #rgb, #rrggbb) to #rrggbb sRGB
  const mask = `#${new THREE.Color(colorHex).getHexString()}`;
  const labels = pinLabels.length ? pinLabels : DEFAULT_PIN_LABELS;

  const make = (layer: PcbLayer, srgb: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = TEX;
    canvas.height = TEX;
    const ctx = canvas.getContext("2d");
    if (ctx) paintPcb(ctx, layer, mask, boardName, labels, size, uno);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };

  return { map: make("color", true), roughnessMap: make("rough", false) };
}

/**
 * Arduino Uno R3 outline: rounded rectangle with the authentic notch on the
 * right edge and 4 drilled ENIG mounting holes. Shape Y = board Z; the board
 * is extruded PCB_T thick and centred on y = 0.
 */
function buildUnoBoardGeometry(w: number, d: number): THREE.ExtrudeGeometry {
  const r = 0.22; // corner radius
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const nd = 0.5; // notch depth
  const nz0 = 0.35; // notch span along the right edge
  const nz1 = 1.35;

  const s = new THREE.Shape();
  s.moveTo(x0 + r, z0);
  s.lineTo(x1 - r, z0);
  s.absarc(x1 - r, z0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, nz0);
  s.lineTo(x1 - nd, nz0);
  s.lineTo(x1 - nd, nz1);
  s.lineTo(x1, nz1);
  s.lineTo(x1, z1 - r);
  s.absarc(x1 - r, z1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, z1);
  s.absarc(x0 + r, z1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, z0 + r);
  s.absarc(x0 + r, z0 + r, r, Math.PI, Math.PI * 1.5, false);
  s.closePath();

  for (const [hx, hz] of [
    [-2.9, 2.3],
    [3.1, 2.3],
    [3.1, -2.3],
    [-1.9, -2.3],
  ] as [number, number][]) {
    const hole = new THREE.Path();
    hole.absarc(hx, hz, 0.1, 0, Math.PI * 2, true);
    s.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: PCB_T - 0.04,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, PCB_T / 2, 0);
  return geo;
}

/** Metallic tie-point sockets for the 170-pt breadboard (Fig. 02). */
function TiePoints() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pts = useMemo(() => {
    const list: [number, number][] = [];
    const pitchX = 0.262;
    const x0 = -(16 * pitchX) / 2;
    for (let c = 0; c < 17; c++) {
      for (let r = 0; r < 5; r++) {
        for (const s of [1, -1]) {
          list.push([x0 + c * pitchX, s * (0.36 + r * 0.25)]);
        }
      }
    }
    for (let c = 0; c < 20; c++) {
      const x = -2.28 + c * 0.24;
      for (const dz of [0.17, 0.3]) {
        list.push([x, 1.44 + dz]);
        list.push([x, -(1.44 + dz)]);
      }
    }
    return list;
  }, []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    pts.forEach(([x, z], i) => {
      m.setPosition(x, PCB_T / 2 + 0.008, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [pts]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, pts.length]}
      receiveShadow
      castShadow
    >
      {/* small spring clip seated inside each dark recessed socket mouth */}
      <boxGeometry args={[0.042, 0.016, 0.042]} />
      <meshStandardMaterial color="#b7bbc0" metalness={0.92} roughness={0.3} />
    </instancedMesh>
  );
}

/**
 * Docked 5V / D13 / GND power & GPIO breakout. A mini blue PCB butted against
 * the breadboard's left edge, its three gold-rimmed female Dupont sockets at
 * world [-2.35, -0.55], [-2.35, 0] and [-2.35, +0.55] — real hardware targets
 * for the Fig. 02 jumper boots instead of empty bench space.
 */
function PowerHeaderDock() {
  const sockets: { z: number; tint: string }[] = [
    { z: -0.55, tint: "#dc2626" }, // 5V
    { z: 0, tint: "#f59e0b" }, // D13
    { z: 0.55, tint: "#18181b" }, // GND
  ];
  // group sits at x = -2.6, so local x = +0.25 lands exactly on world x = -2.35
  const socketX = 0.25;
  return (
    <group position={[-2.6, 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.62, PCB_T, 1.72]} />
        <meshStandardMaterial
          color="#1450a0"
          roughness={0.45}
          metalness={0.12}
        />
      </mesh>
      {sockets.map(({ z, tint }) => (
        <group key={z} position={[socketX, 0, z]}>
          {/* black female Dupont housing, top flush with the board surface */}
          <mesh position={[0, 0.041, 0]} castShadow>
            <boxGeometry args={[0.19, 0.088, 0.19]} />
            <meshStandardMaterial color="#0e0e10" roughness={0.6} />
          </mesh>
          {/* recessed contact well */}
          <mesh
            position={[0, PCB_T / 2 + 0.006, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.052, 20]} />
            <meshStandardMaterial color="#120f08" roughness={0.85} />
          </mesh>
          {/* gold-rimmed socket mouth */}
          <mesh
            position={[0, PCB_T / 2 + 0.008, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.052, 0.078, 20]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.95}
              roughness={0.22}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* tiny colour key dot on the silkscreen beside each socket */}
          <mesh
            position={[0, PCB_T / 2 + 0.01, 0.14]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.024, 12]} />
            <meshStandardMaterial
              color={tint}
              emissive={tint}
              emissiveIntensity={0.35}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Active-trace current-flow pulses. Each styled board gets a set of polylines
 * routed through its real part positions (power in → load → return); glowing
 * electron pulses travel along them while the board is powered, and the whole
 * group unmounts (halting instantly) the moment the circuit is broken.
 */
const FLOW_PATHS: Record<BoardStyleName, [number, number][][]> = {
  breadboard: [
    [
      [-2.2, 1.61],
      [2.2, 1.61],
    ], // red rail
    [
      [2.2, -1.61],
      [-2.2, -1.61],
    ], // blue rail
    [
      [-2.2, 1.61],
      [-1.55, 1.61],
      [-1.55, 0.85],
      [-0.35, 0.35],
      [0.55, 0.35],
    ], // feed → R1 → LED
    [
      [0.55, 0.35],
      [0.55, -0.85],
      [-1.55, -0.85],
      [-1.55, -1.61],
      [-2.2, -1.61],
    ], // return
  ],
  perfboard: [
    [
      [-2.05, -1.25],
      [0, -0.3],
      [1.9, 0.75],
    ], // 12 V through the relay coil
    [
      [-0.9, 0.35],
      [0.45, 1.1],
    ], // base drive Q1 → R-B
    [
      [0.45, 0.2],
      [-0.9, 0.35],
    ], // pull-down R-D → Q1
    [
      [1.5, -0.55],
      [1.9, 0.75],
    ], // flyback loop D1 → coil
  ],
  "devkit-narrow": [
    [
      [-2.75, 0.3],
      [-1.55, 0],
      [0.55, 0.15],
    ], // COM USB → CP2102N → WROOM-1
    [
      [-2.75, -0.3],
      [-1.55, 0],
    ], // OTG USB
    [
      [-0.75, 0.85],
      [0.55, 0.15],
    ], // AMS1117 3V3 rail
    [
      [0.55, 0.15],
      [0.75, -0.85],
    ], // WROOM-1 → WS2812
    [
      [0.55, 0.15],
      [2.55, 0.55],
    ], // WROOM-1 → decoupling tank
  ],
  "hc-sr04": [
    [
      [-1.95, 0],
      [-0.9, 0.5],
      [1.7, 0.85],
    ], // header → MAX232 → T can
    [
      [1.7, -0.85],
      [-0.9, -0.55],
    ], // R can → LM324
    [
      [-0.9, -0.55],
      [-0.9, 0.5],
    ], // LM324 → MAX232
    [
      [0.55, 0.05],
      [-0.9, 0.5],
    ], // crystal timebase
  ],
};

const PULSES_PER_PATH = 2;

export function CurrentFlow({ style }: { style: BoardStyleName }) {
  const g = useRef<THREE.Group>(null);
  const paths = useMemo(() => FLOW_PATHS[style], [style]);
  const lengths = useMemo(
    () =>
      paths.map((pts) => {
        const seg: number[] = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          const l = Math.hypot(
            pts[i][0] - pts[i - 1][0],
            pts[i][1] - pts[i - 1][1],
          );
          seg.push(l);
          total += l;
        }
        return { seg, total };
      }),
    [paths],
  );
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.children.forEach((child, i) => {
      const pi = Math.floor(i / PULSES_PER_PATH);
      const path = paths[pi];
      const { seg, total } = lengths[pi];
      const d =
        ((t * (0.5 + (pi % 3) * 0.14) +
          (i % PULSES_PER_PATH) / PULSES_PER_PATH) %
          1) *
        total;
      let acc = 0;
      let x = path[0][0];
      let z = path[0][1];
      for (let s = 0; s < seg.length; s++) {
        if (d <= acc + seg[s]) {
          const f = seg[s] > 0 ? (d - acc) / seg[s] : 0;
          x = path[s][0] + (path[s + 1][0] - path[s][0]) * f;
          z = path[s][1] + (path[s + 1][1] - path[s][1]) * f;
          break;
        }
        acc += seg[s];
      }
      child.position.set(x, 0, z);
      child.scale.setScalar(0.75 + Math.sin(t * 7 + i * 1.7) * 0.3);
    });
  });
  const count = paths.length * PULSES_PER_PATH;
  return (
    <group ref={g} position={[0, PCB_T / 2 + 0.07, 0]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial
            color="#ffe066"
            emissive="#ffb300"
            emissiveIntensity={2.6}
            transparent
            opacity={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Pcb({
  color,
  explode,
  generic,
  boardName,
  pinLabels,
}: {
  color: string;
  explode: number;
  generic?: string;
  boardName?: string;
  pinLabels?: string[];
}) {
  if (!generic && isBatch23Style(boardName)) {
    return (
      <Batch23PcbBase boardName={boardName} explode={explode} />
    );
  }
  const ref = useRef<THREE.Group>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  const style = !generic && !!boardName ? boardStyleOf(boardName) : null;
  const [w, d] = generic ? [4, 2.6] : style ? STYLE_DIMS[style] : [6.9, 5.3];
  // styled boards force their authentic base colour (breadboard plastic,
  // black devkit mask, HC-SR04 blue); the Uno keeps the bench colour picker
  const maskColor = style ? STYLE_MASK[style] : color;
  const title = generic ?? boardName ?? "ROBOTICS BENCH";
  const isUno = !generic && !!boardName && /uno/i.test(boardName);
  const labels = (isUno && !pinLabels ? UNO_PIN_LABELS : pinLabels) ?? [];
  const labelKey = labels.join("|");

  // Fig. 01 gets the authentic notched outline; every other board keeps the
  // rounded rectangle.
  const unoGeo = useMemo(
    () => (isUno ? buildUnoBoardGeometry(w, d) : null),
    [isUno, w, d],
  );
  useEffect(
    () => () => {
      unoGeo?.dispose();
    },
    [unoGeo],
  );

  const textures = useMemo(
    () => createPcbTexture(maskColor, title, labels, [w, d], isUno),
    // pinLabels is tracked through labelKey so an inline array doesn't rebuild the canvas every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maskColor, title, labelKey, w, d, isUno],
  );
  useEffect(
    () => () => {
      textures.map.dispose();
      textures.roughnessMap.dispose();
    },
    [textures],
  );

  // Planar top-down UVs for the board: canvas top = +Z edge, canvas right = +X.
  // Side faces then sample the soldermask-only border of the texture.
  useLayoutEffect(() => {
    const geo = boxRef.current?.geometry;
    const pos = geo?.attributes.position;
    const uv = geo?.attributes.uv;
    if (!geo || !pos || !uv) return;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / w + 0.5, 0.5 - pos.getZ(i) / d);
    }
    uv.needsUpdate = true;
  }, [w, d, textures, unoGeo]);

  useFrame(() => {
    if (ref.current) ref.current.position.y = -explode * 0.6;
  });

  return (
    <group ref={ref}>
      {unoGeo ? (
        <mesh ref={boxRef} geometry={unoGeo} receiveShadow castShadow>
          <meshStandardMaterial
            color="#ffffff"
            map={textures.map}
            roughnessMap={textures.roughnessMap}
            roughness={1}
            metalness={0.05}
          />
        </mesh>
      ) : (
        <RoundedBox
          ref={boxRef}
          args={[w, PCB_T, d]}
          radius={0.07}
          smoothness={3}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial
            color="#ffffff"
            map={textures.map}
            roughnessMap={textures.roughnessMap}
            roughness={1}
            metalness={0.05}
          />
        </RoundedBox>
      )}
      {generic && (
        <group position={[0, PCB_T / 2, 0]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[1.2, 0.2, 1.2]} />
            <meshStandardMaterial color={dark} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.2, 1.1]} castShadow>
            <boxGeometry args={[3, 0.4, 0.25]} />
            <meshStandardMaterial color="#151515" roughness={0.45} />
          </mesh>
        </group>
      )}
      {style === "breadboard" && (
        <>
          <TiePoints />
          <PowerHeaderDock />
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  .glb part matching (used by Viewport3D for CAD sub-mesh mapping)   */
/* ------------------------------------------------------------------ */

/** Lower-cases and strips everything but a-z0-9, for forgiving name compares. */
export const normPartName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Matches a node name from a .glb to one of the board's parts.
 * Exact id / name wins, then an id token ("U1_body" -> u1), then a name
 * substring. Blender-style duplicate suffixes (".001") are ignored.
 */
export function matchGlbPart(rawName: string, parts: Part[]): Part | null {
  if (!rawName) return null;
  const clean = rawName.replace(/[._ ]\d{3}$/, "");
  const full = normPartName(clean);
  if (!full) return null;
  const tokens = clean
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let best: Part | null = null;
  let bestScore = 0;
  for (const p of parts) {
    const id = normPartName(p.id);
    const nm = normPartName(p.name);
    let score = 0;
    if (full === id || full === nm) score = 100;
    else if (id && tokens.includes(id)) score = 80 + id.length;
    else if (id.length >= 4 && full.includes(id)) score = 60 + id.length;
    else if (nm.length >= 4 && full.includes(nm)) score = 40 + nm.length;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}
