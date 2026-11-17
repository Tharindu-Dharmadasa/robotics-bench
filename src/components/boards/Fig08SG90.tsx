// Fig08SG90.tsx – SG90 Micro Servo Mechanical Cutaway (Fig. 08)
// ---------------------------------------------------------------
// 1. Fig08SG90Base – clean translucent acrylic test jig (3.2 × 1.4) with
//    brass mounting standoffs and a 3-wire Dupont ribbon:
//    Brown GND / Red 5V / Orange PWM.
// 2. Fig08SG90Part – translucent blue polycarbonate housing (opacity 0.36,
//    roughness 0.15) revealing a brushed coreless DC motor can, 4
//    interlocking white/brass spur gears that spin proportionally in
//    useFrame when lit, the 5kΩ feedback pot directly beneath the output
//    shaft, the KC5188 H-bridge control PCB, and a white servo arm horn
//    sweeping ±60° when running — or grinding continuously into the
//    end-stop if the feedback pot is removed (open-loop runaway).
// 3. No @react-three/drei <Html> / <Text> inside <Canvas>.
// ---------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Part } from "../../types/simulator";

const JIG_W = 3.2;
const JIG_D = 1.4;
const JIG_T = 0.12;

/**
 * Cross-component presence flag: set while the 5kΩ feedback pot part is
 * mounted (mounted on commit, cleared on unmount). The servo mechanism
 * reads it in useFrame to decide closed-loop sweep vs. open-loop runaway.
 */
export const sg90Feedback = { potMounted: false };

/* ------------------------------------------------------------------ */
/*  Acrylic test jig base                                              */
/* ------------------------------------------------------------------ */

function createJigLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("SG90 SERVO TEST JIG", 256, 52);
  ctx.font = "bold 20px monospace";
  ctx.fillStyle = "rgba(93,64,55,1)";
  ctx.fillText("■ BRN GND", 110, 100);
  ctx.fillStyle = "rgba(211,47,47,1)";
  ctx.fillText("■ RED 5V", 256, 100);
  ctx.fillStyle = "rgba(245,124,0,1)";
  ctx.fillText("■ ORG PWM", 400, 100);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Fig08SG90Base({ color }: { color?: string }) {
  const labelTex = useMemo(() => createJigLabelTexture(), []);
  useEffect(() => () => labelTex.dispose(), [labelTex]);

  // Ribbon runs from the servo case to the 3-pin lead connector.
  const ribbonX = -1.0;
  const ribbonLen = 0.95;
  const wireZ = [-0.6, -0.35, -0.1];
  const wireColors = ["#5d4037", "#d32f2f", "#f57c00"]; // Brown/Red/Orange

  return (
    <group>
      {/* Acrylic jig slab */}
      <RoundedBox
        args={[JIG_W, JIG_T, JIG_D]}
        radius={0.05}
        smoothness={3}
        position={[0, -JIG_T / 2, 0]}
        receiveShadow
        castShadow
      >
        <meshPhysicalMaterial
          color="#cfe9f6"
          transparent
          opacity={0.5}
          roughness={0.12}
          metalness={0}
          ior={1.49}
        />
      </RoundedBox>

      {/* Brass mounting standoffs under the servo flange holes */}
      {[
        [-0.6, -0.45],
        [0.6, -0.45],
        [-0.6, 0.45],
        [0.6, 0.45],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.1, 16]} />
            <meshStandardMaterial
              color="#c9a227"
              metalness={0.9}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.102, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.01, 12]} />
            <meshStandardMaterial color="#3a3a3e" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* 3-wire Dupont ribbon: Brown GND / Red 5V / Orange PWM */}
      {wireZ.map((z, i) => (
        <mesh
          key={z}
          position={[ribbonX, 0.028, z]}
          castShadow
        >
          <boxGeometry args={[ribbonLen, 0.05, 0.05]} />
          <meshStandardMaterial color={wireColors[i]} roughness={0.55} />
        </mesh>
      ))}
      {/* Case exit gland */}
      <mesh position={[-0.5, 0.045, -0.35]} castShadow>
        <boxGeometry args={[0.12, 0.09, 0.6]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.5} />
      </mesh>
      {/* Dupont connector shell at the 3-pin lead */}
      <mesh position={[-1.45, 0.06, -0.35]} castShadow>
        <boxGeometry args={[0.16, 0.12, 0.68]} />
        <meshStandardMaterial color="#0c0c0e" roughness={0.5} />
      </mesh>

      {/* Engraved legend */}
      <mesh position={[-1.0, 0.003, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 0.28]} />
        <meshStandardMaterial
          map={labelTex}
          transparent
          roughness={0.4}
          metalness={0}
        />
      </mesh>
      {/* Subtle accent strip tinted by the board style */}
      <mesh position={[1.25, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 1.2]} />
        <meshStandardMaterial
          color={color ?? "#145cb6"}
          transparent
          opacity={0.12}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  KC5188 control PCB texture (inside the housing)                    */
/* ------------------------------------------------------------------ */

const PCB_W = 0.92;
const PCB_D = 1.06;

function createKc5188Texture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a6b3c";
  ctx.fillRect(0, 0, 256, 256);

  // Routed traces (45°)
  ctx.strokeStyle = "rgba(190,240,200,0.25)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const traces: Array<Array<[number, number]>> = [
    [[40, 30], [40, 80], [80, 120]],
    [[70, 30], [110, 70], [110, 130]],
    [[216, 60], [170, 106], [170, 140]],
    [[216, 120], [180, 156], [180, 180]],
    [[30, 200], [80, 200], [110, 170]],
    [[128, 240], [128, 200]],
  ];
  traces.forEach((pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  });

  // IC footprint (ctrl_ic lands here)
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(58.4 - 42, 200.6 - 36, 84, 73);
  // Pot footprint (fb_pot lands here)
  ctx.beginPath();
  ctx.ellipse(128, 128, 33, 29, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Cap footprint (cap_motor lands here)
  ctx.strokeRect(44.5 - 28, 26.6 - 14, 56, 29);

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textAlign = "center";
  ctx.font = "bold 16px monospace";
  ctx.fillText("KC5188", 128, 60);
  ctx.font = "bold 12px monospace";
  ctx.fillText("H-BRIDGE", 128, 236);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Spur gear                                                          */
/* ------------------------------------------------------------------ */

function SpurGear({
  gearRef,
  r,
  x,
  z,
  y,
  teeth,
  brass,
  thickness = 0.07,
}: {
  /** Ref that spins the gear around its own centre in useFrame. */
  gearRef?: React.RefObject<THREE.Group | null>;
  r: number;
  x: number;
  z: number;
  y: number;
  teeth: number;
  brass?: boolean;
  thickness?: number;
}) {
  const mat = brass ? (
    <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.28} />
  ) : (
    <meshStandardMaterial color="#f2f0ea" roughness={0.42} />
  );
  return (
    <group ref={gearRef} position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, thickness, 24]} />
        {mat}
      </mesh>
      {/* Hub */}
      <mesh position={[0, thickness / 2 + 0.008, 0]}>
        <cylinderGeometry args={[r * 0.35, r * 0.35, 0.02, 16]} />
        {brass ? (
          <meshStandardMaterial color="#8a6d1d" metalness={0.9} roughness={0.3} />
        ) : (
          <meshStandardMaterial color="#d8d5cc" roughness={0.5} />
        )}
      </mesh>
      {/* Teeth ring for the interlocked look */}
      {Array.from({ length: teeth }).map((_, i) => {
        const a = (i / teeth) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(a) * (r + 0.014),
              0,
              Math.sin(a) * (r + 0.014),
            ]}
            rotation={[0, -a, 0]}
            castShadow
          >
            <boxGeometry args={[0.032, thickness, 0.05]} />
            {mat}
          </mesh>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Servo mechanism (servo_body)                                       */
/* ------------------------------------------------------------------ */

const GEAR_Y = 0.58;

function Sg90Mechanism({ lit }: { lit: boolean }) {
  const hornRef = useRef<THREE.Group>(null);
  const gear1 = useRef<THREE.Group>(null);
  const gear2 = useRef<THREE.Group>(null);
  const gear3 = useRef<THREE.Group>(null);
  const gear4 = useRef<THREE.Group>(null);
  const state = useRef({ angle: 0 });

  useFrame((s, dt) => {
    const t = s.clock.getElapsedTime();
    const st = state.current;
    const pot = sg90Feedback.potMounted;

    if (lit && pot) {
      // Closed loop: smooth ±60° sweep
      st.angle = Math.sin(t * 1.5) * (Math.PI / 3);
    } else if (lit && !pot) {
      // Open-loop runaway: drives continuously into the hard end-stop
      const END = Math.PI / 2 + 0.25;
      st.angle += dt * 2.6;
      if (st.angle >= END) {
        st.angle = END;
        st.angle += Math.sin(t * 38) * 0.02; // stall grind
      }
    } else {
      st.angle *= 0.9; // unpowered, drifts to neutral
    }

    if (hornRef.current) hornRef.current.rotation.y = st.angle;
    // Proportional gear train: ω ∝ 1/r with alternating sign
    if (gear4.current) gear4.current.rotation.y = st.angle;
    if (gear3.current) gear3.current.rotation.y = -st.angle;
    if (gear2.current) gear2.current.rotation.y = st.angle * 0.645;
    if (gear1.current) gear1.current.rotation.y = -st.angle * 1.333;
  });

  const housing = (
    <meshPhysicalMaterial
      color="#1f6fd0"
      transparent
      opacity={0.36}
      roughness={0.15}
      metalness={0.05}
      depthWrite={false}
      ior={1.45}
    />
  );

  const pcbTex = useMemo(() => createKc5188Texture(), []);
  useEffect(() => () => pcbTex.dispose(), [pcbTex]);

  return (
    <group>
      {/* KC5188 H-bridge control PCB (floor of the housing) */}
      <group position={[0, 0.012, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[PCB_W, 0.03, PCB_D]} />
          <meshStandardMaterial color="#16543a" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PCB_W, PCB_D]} />
          <meshStandardMaterial map={pcbTex} roughness={0.4} metalness={0.1} />
        </mesh>
      </group>

      {/* Translucent blue polycarbonate housing — cutaway front face */}
      <mesh position={[0, 0.535, -0.595]} castShadow>
        <boxGeometry args={[1.05, 1.07, 0.06]} />
        {housing}
      </mesh>
      <mesh position={[-0.495, 0.535, 0.03]} castShadow>
        <boxGeometry args={[0.06, 1.07, 1.19]} />
        {housing}
      </mesh>
      <mesh position={[0.495, 0.535, 0.03]} castShadow>
        <boxGeometry args={[0.06, 1.07, 1.19]} />
        {housing}
      </mesh>
      <mesh position={[0, 1.07, 0]} castShadow>
        <boxGeometry args={[1.05, 0.07, 1.25]} />
        {housing}
      </mesh>
      {/* Mounting flanges with screw holes */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.6, 0.03, 0]} castShadow>
          <boxGeometry args={[0.15, 0.06, 1.4]} />
          {housing}
        </mesh>
      ))}

      {/* Brushed coreless DC motor can */}
      <group>
        <mesh position={[-0.22, 0.3, -0.38]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
          <meshStandardMaterial
            color="#cfd4d8"
            metalness={0.92}
            roughness={0.24}
          />
        </mesh>
        {/* Winding bands */}
        {[-0.34, -0.1].map((x) => (
          <mesh key={x} position={[x, 0.3, -0.38]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.163, 0.163, 0.03, 20]} />
            <meshStandardMaterial color="#2a2c30" roughness={0.5} />
          </mesh>
        ))}
        {/* Rear cap + terminal tabs */}
        <mesh position={[-0.44, 0.3, -0.38]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.16, 0.04, 20]} />
          <meshStandardMaterial color="#1a1a1c" roughness={0.5} />
        </mesh>
        <mesh position={[-0.45, 0.22, -0.38]}>
          <boxGeometry args={[0.06, 0.02, 0.05]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* Motor shaft riser up to the pinion */}
        <mesh position={[-0.26, 0.52, -0.34]}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 10]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.28} />
        </mesh>
      </group>

      {/* 4 interlocking spur gears (spin proportionally when lit) */}
      <SpurGear gearRef={gear1} r={0.075} x={-0.26} z={-0.34} y={GEAR_Y} teeth={10} brass />
      <SpurGear gearRef={gear2} r={0.155} x={-0.04} z={-0.28} y={GEAR_Y} teeth={16} />
      <SpurGear gearRef={gear3} r={0.1} x={0.16} z={-0.12} y={GEAR_Y} teeth={12} brass />
      <SpurGear gearRef={gear4} r={0.1} x={0} z={0} y={GEAR_Y} teeth={12} />

      {/* Output shaft: gear spline up through the top boss */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 1.0, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Top output boss */}
      <mesh position={[0, 1.145, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.28} />
      </mesh>

      {/* White servo arm horn (±60° sweep / end-stop grind) */}
      <group ref={hornRef} position={[0, 1.21, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.095, 0.095, 0.055, 16]} />
          <meshStandardMaterial color="#f8f8f6" roughness={0.35} />
        </mesh>
        <mesh position={[0.3, 0.005, 0]} castShadow>
          <boxGeometry args={[0.52, 0.045, 0.13]} />
          <meshStandardMaterial color="#f8f8f6" roughness={0.35} />
        </mesh>
        {[0.2, 0.32, 0.44].map((x) => (
          <mesh key={x} position={[x, 0.031, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.01, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        ))}
        <mesh position={[0, 0.038, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.016, 10]} />
          <meshStandardMaterial color="#444" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  5kΩ feedback pot (fb_pot) — directly beneath the output shaft      */
/* ------------------------------------------------------------------ */

function FeedbackPot() {
  // Register presence so the mechanism can detect the open-loop fault.
  useEffect(() => {
    sg90Feedback.potMounted = true;
    return () => {
      sg90Feedback.potMounted = false;
    };
  }, []);

  return (
    <group>
      {/* Phenolic pot body standing on the control PCB */}
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.115, 0.115, 0.16, 18]} />
        <meshStandardMaterial color="#26262a" roughness={0.5} />
      </mesh>
      {/* Wiper shaft */}
      <mesh position={[0, 0.23, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.28} />
      </mesh>
      {/* Solder tabs */}
      {[-0.09, 0, 0.09].map((z) => (
        <mesh key={z} position={[0.11, 0.05, z]}>
          <boxGeometry args={[0.05, 0.02, 0.03]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Part dispatch (per Fig. 08 part id)                                */
/* ------------------------------------------------------------------ */

export const FIG08_PART_IDS = new Set([
  "servo_body",
  "ctrl_ic",
  "fb_pot",
  "cap_motor",
  "hdr_pwm",
]);

export function isFig08Part(id?: string): boolean {
  return !!id && FIG08_PART_IDS.has(id);
}

export function Fig08SG90Part({ part, lit }: { part: Part; lit?: boolean }) {
  switch (part.id) {
    case "servo_body":
      return <Sg90Mechanism lit={!!lit} />;
    case "fb_pot":
      return <FeedbackPot />;
    default:
      // ctrl_ic (qfp), cap_motor (cap) and hdr_pwm (hdr) sub-parts keep
      // their existing generic geometry; the KC5188 PCB texture draws
      // matching footprints so each part stays individually placeable.
      return null;
  }
}
