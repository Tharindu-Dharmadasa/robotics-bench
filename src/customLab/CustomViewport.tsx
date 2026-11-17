// src/customLab/CustomViewport.tsx

/**
 * Custom experiment sandbox viewport.
 *
 * Renders a 3D workbench with a breadboard, Arduino header strip, right-hand
 * docking bay (SG90 servo + SSD1306 OLED) and every placed part as a distinct
 * brightly colored procedural mesh. Cursor modes ("place", "wire", "probe",
 * "remove") are owned by CustomLabWorkspace and pushed in as props.
 *
 * NOTE: No @react-three/drei <Html> or <Text> components are used inside
 * <Canvas>, per the strict project rule — all labels live in the 2D HUD
 * overlay outside the canvas.
 */

import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  CustomComponentType,
  CustomSimResult,
  CustomWire,
  PlacedCustomPart,
} from "./customTypes";

/* ------------------------------ layout helpers ----------------------------- */

const COL_SPACING = 0.8;
const BOARD_TOP = 0.4;
const colX = (col: number) => (col - 15.5) * COL_SPACING;
const rowZ = (row: "top" | "bottom") => (row === "top" ? -0.7 : 0.7);

/** Types that dock in the right-hand bay instead of sitting on the breadboard. */
const BAY_TYPES: CustomComponentType[] = ["sg90_servo", "oled_i2c"];
const SERVO_BAY: [number, number, number] = [15.3, BOARD_TOP, -2.3];
const OLED_BAY: [number, number, number] = [15.3, BOARD_TOP, 2.3];

/** Leg-to-leg offsets (local x) by leg count. */
const LEG_OFFSETS: Record<number, number[]> = {
  2: [-0.4, 0.4],
  3: [-0.8, 0, 0.8],
  4: [-1.2, -0.4, 0.4, 1.2],
};

const PART_LEG_COUNT: Record<CustomComponentType, number> = {
  led_red: 2,
  led_green: 2,
  res_220: 2,
  res_10: 2,
  res_10k: 2,
  button: 2,
  npn_2n2222: 3,
  diode_1n4007: 2,
  sg90_servo: 3,
  oled_i2c: 4,
};

/** Resolves any clickable pin id to its 3D position on the bench. */
function resolvePin(pinId: string): THREE.Vector3 {
  const colMatch = pinId.match(/^col(\d+)_(top|bottom)$/);
  if (colMatch) {
    return new THREE.Vector3(
      colX(parseInt(colMatch[1], 10)),
      0.5,
      rowZ(colMatch[2] as "top" | "bottom"),
    );
  }
  const railMatch = pinId.match(/^rail_(5V|3V3|GND)(?:_col(\d+))?$/);
  if (railMatch) {
    const col = railMatch[2] ? parseInt(railMatch[2], 10) : 2;
    const z = railMatch[1] === "GND" ? 1.8 : -1.8;
    return new THREE.Vector3(colX(col), 0.5, z);
  }
  // Arduino pins – left header strip (matches the header-strip pin rows)
  const unoMap: Record<string, [number, number, number]> = {
    uno_5V: [-14.5, 0.6, 2.25],
    uno_3V3: [-14.5, 0.6, 1.5],
    uno_GND: [-14.5, 0.6, 0.75],
    uno_D9: [-14.5, 0.6, 0],
    uno_D13: [-14.5, 0.6, -0.75],
    uno_SDA: [-14.5, 0.6, -1.5],
    uno_SCL: [-14.5, 0.6, -2.25],
  };
  const uno = unoMap[pinId];
  if (uno) return new THREE.Vector3(uno[0], uno[1], uno[2]);
  return new THREE.Vector3(0, 0.5, 0);
}

/* -------------------------------- breadboard ------------------------------- */

/** Cheap shared material for the gold Arduino header pins. */
const pinMaterial = new THREE.MeshStandardMaterial({
  color: "#d4af37",
  metalness: 0.8,
  roughness: 0.2,
});

/** Simple 3-D object representing a single breadboard tie-point. */
function BreadboardHole({
  position,
  socketColor,
  hovered,
}: {
  position: [number, number, number];
  socketColor: string;
  hovered: boolean;
}) {
  return (
    <group position={position}>
      {/* metallic contact ring around the tie-point (crisp under studio light) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <torusGeometry args={[0.2, 0.03, 8, 20]} />
        <meshStandardMaterial
          color="#9ca3af"
          metalness={0.85}
          roughness={0.3}
          emissive="#ffb020"
          emissiveIntensity={hovered ? 0.55 : 0}
        />
      </mesh>
      {/* recessed socket */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.14, 10]} />
        <meshStandardMaterial color={socketColor} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** The entire breadboard grid (30 cols × 2 halves + 5V/GND power rails). */
function Breadboard({
  onPinClick,
  onHoverPin,
}: {
  onPinClick: (pinId: string) => void;
  onHoverPin: (pinId: string | null) => void;
}) {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const holes: React.ReactElement[] = [];
  const spacing = 0.8;

  const body = (
    <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
      <boxGeometry args={[26.5, 0.7, 4.6]} />
      <meshStandardMaterial color="#f3f1ea" roughness={0.55} />
    </mesh>
  );

  for (let col = 1; col <= 30; col++) {
    for (const half of ["top", "bottom"] as const) {
      const x = (col - 15.5) * spacing;
      const z = half === "top" ? -0.7 : 0.7;
      const pinId = `col${col}_${half}`;
      holes.push(
        <group
          key={pinId}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPinClick(pinId);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredPin(pinId);
            onHoverPin(pinId);
          }}
          onPointerOut={() => {
            setHoveredPin(null);
            onHoverPin(null);
          }}
        >
          <BreadboardHole
            position={[x, 0.4, z]}
            socketColor="#3a3a3a"
            hovered={hoveredPin === pinId}
          />
        </group>,
      );
    }
  }
  for (let col = 1; col <= 30; col++) {
    const x = (col - 15.5) * spacing;
    const rails = [
      { half: "5V", z: -1.8, color: "#ff5555" },
      { half: "GND", z: 1.8, color: "#5555ff" },
    ];
    for (const rail of rails) {
      const pinId = `rail_${rail.half}_col${col}`;
      holes.push(
        <group
          key={pinId}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPinClick(pinId);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredPin(pinId);
          }}
          onPointerOut={() => {
            setHoveredPin(null);
            onHoverPin(null);
          }}
        >
          <BreadboardHole
            position={[x, 0.4, rail.z]}
            socketColor={rail.color}
            hovered={hoveredPin === pinId}
          />
        </group>,
      );
    }
  }
  return <group>{[body, ...holes]}</group>;
}

/* ---------------------------------- wires ---------------------------------- */

/** A jumper wire rendered as a sagging tube; clickable in "remove" mode. */
function Wire({
  from,
  to,
  color,
  isActive,
  isShorted,
  removable,
  highlighted,
  onHover,
  onRemove,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  isActive: boolean;
  isShorted: boolean;
  removable: boolean;
  highlighted: boolean;
  onHover: (hovered: boolean) => void;
  onRemove: () => void;
}) {
  const geometry = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += Math.min(1.4, from.distanceTo(to) * 0.14) + 0.15;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    return new THREE.TubeGeometry(curve, 24, 0.07, 8, false);
  }, [from, to]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isShorted ? "#ff2d2d" : color,
        emissive: isShorted ? "#ff2d2d" : isActive ? "#ff9d2e" : "#000000",
        emissiveIntensity: isShorted ? 0.5 : isActive ? 0.55 : highlighted ? 0.4 : 0,
        transparent: isShorted,
        opacity: isShorted ? 0.75 : 1,
        roughness: 0.55,
      }),
    [color, isActive, isShorted, highlighted],
  );
  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow
      onPointerDown={
        removable
          ? (e) => {
              e.stopPropagation();
              onRemove();
            }
          : undefined
      }
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    />
  );
}

/* ------------------------------- part meshes ------------------------------- */

/** Metal legs dipping into the breadboard tie-points (local x offsets). */
function PartLegs({ count, color = "#c8ccd2" }: { count: number; color?: string }) {
  const offsets = LEG_OFFSETS[count] ?? LEG_OFFSETS[2];
  return (
    <>
      {offsets.map((x, i) => (
        <mesh key={i} position={[x, BOARD_TOP + 0.05, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.55, 6]} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}

/** Red selection ring shown under a part hovered in "remove" mode. */
function SelectionRing({ y }: { y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[0.55, 0.72, 28]} />
      <meshBasicMaterial
        color="#ff3b30"
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** 5 mm LED — translucent dome that glows when lit, chars black when burned. */
function LedMesh({
  color,
  lit,
  brightness,
  burned,
}: {
  color: string;
  lit: boolean;
  brightness: number;
  burned: boolean;
}) {
  const glow = lit && !burned;
  const intensity = glow ? 0.55 + brightness * 1.25 : 0.04;
  const material = (
    <meshStandardMaterial
      color={burned ? "#26221f" : color}
      emissive={burned ? "#000000" : color}
      emissiveIntensity={intensity}
      roughness={0.25}
      transparent
      opacity={0.92}
    />
  );
  return (
    <group>
      <PartLegs count={2} />
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.48, 16]} />
        {material}
      </mesh>
      {/* glowing dome */}
      <mesh position={[0, 0.96, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {material}
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.06, 16]} />
        {material}
      </mesh>
      {glow && (
        <pointLight
          position={[0, 0.9, 0]}
          color={color}
          intensity={1.2 + brightness * 2.2}
          distance={3.2}
        />
      )}
    </group>
  );
}

/** Axial resistor with color bands (4-band code incl. gold tolerance band). */
function ResistorMesh({ bands }: { bands: [string, string, string] }) {
  const bandXs = [-0.3, -0.16, -0.02];
  return (
    <group>
      <PartLegs count={2} />
      <mesh position={[0, 0.64, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 1.0, 14]} />
        <meshStandardMaterial color="#e7d5a4" roughness={0.55} />
      </mesh>
      {bandXs.map((x, i) => (
        <mesh key={i} position={[x, 0.64, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.07, 14]} />
          <meshStandardMaterial color={bands[i]} roughness={0.4} />
        </mesh>
      ))}
      {/* gold tolerance band */}
      <mesh position={[0.2, 0.64, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.07, 14]} />
        <meshStandardMaterial color="#d4af37" metalness={0.6} roughness={0.3} />
      </mesh>
      {[-0.44, 0.44].map((x) => (
        <mesh key={x} position={[x, 0.64, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.12, 14]} />
          <meshStandardMaterial color="#c8ccd2" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** Tactile momentary button — black body with a bright red cap. */
function ButtonMesh() {
  return (
    <group>
      <PartLegs count={2} />
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[0.6, 0.32, 0.6]} />
        <meshStandardMaterial color="#17181c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.84, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.14, 16]} />
        <meshStandardMaterial color="#e11d48" roughness={0.35} />
      </mesh>
    </group>
  );
}

/** 2N2222 in a TO-92 black plastic package with a printed label face. */
function NpnMesh() {
  return (
    <group>
      <PartLegs count={3} />
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.42, 20]} />
        <meshStandardMaterial color="#141414" roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.72, 0.235]}>
        <boxGeometry args={[0.2, 0.22, 0.02]} />
        <meshStandardMaterial color="#e5e5e5" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** 1N4007 axial diode — black body, silver band at the cathode end. */
function DiodeMesh() {
  return (
    <group>
      <PartLegs count={2} />
      <mesh position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.115, 0.115, 0.9, 14]} />
        <meshStandardMaterial color="#1b1c20" roughness={0.4} />
      </mesh>
      {/* cathode band (leg B side) */}
      <mesh position={[0.3, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.09, 14]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 14]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/** SG90 servo in the docking bay — blue body, horn sweeps when driven. */
function ServoRig({ active }: { active: boolean }) {
  const horn = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (horn.current) {
      horn.current.rotation.y = active
        ? Math.sin(clock.elapsedTime * 1.8) * 1.45
        : Math.PI / 2;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[1.5, 1.04, 0.82]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[2.05, 0.12, 0.95]} />
        <meshStandardMaterial color="#1e40af" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.2, 16]} />
        <meshStandardMaterial color="#f4f4f5" roughness={0.35} />
      </mesh>
      <group ref={horn} position={[0, 1.24, 0]}>
        <mesh position={[0.5, 0.02, 0]} castShadow>
          <boxGeometry args={[1.05, 0.06, 0.18]} />
          <meshStandardMaterial color="#fafafa" roughness={0.35} />
        </mesh>
      </group>
      {/* signal tail */}
      <mesh position={[-0.95, 0.42, 0]}>
        <boxGeometry args={[0.14, 0.28, 0.45]} />
        <meshStandardMaterial color="#f97316" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** SSD1306 OLED in the docking bay — black glass glowing cyan when active. */
function OledRig({ active }: { active: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[1.85, 0.09, 1.05]} />
        <meshStandardMaterial color="#0b1220" roughness={0.5} />
      </mesh>
      {[
        [-0.7, -0.38],
        [0.7, -0.38],
        [-0.7, 0.38],
        [0.7, 0.38],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.06, z]}>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.24, 0]} castShadow>
        <boxGeometry args={[1.5, 0.05, 0.75]} />
        <meshStandardMaterial
          color={active ? "#03211f" : "#0a0a0c"}
          emissive="#22d3ee"
          emissiveIntensity={active ? 1.35 : 0}
          roughness={0.2}
        />
      </mesh>
      {active &&
        [0.3, 0.18, 0.06, -0.06].map((z, i) => (
          <mesh key={i} position={[0, 0.27, z]}>
            <boxGeometry args={[1.24, 0.01, 0.05]} />
            <meshStandardMaterial
              color="#67e8f9"
              emissive="#22d3ee"
              emissiveIntensity={1.8}
            />
          </mesh>
        ))}
      {active && (
        <pointLight position={[0, 0.7, 0]} color="#22d3ee" intensity={0.9} distance={3} />
      )}
    </group>
  );
}

/** Procedural mesh per seated component type (Rule 3: no .glb dependency). */
function PartBody({
  part,
  lit,
  brightness,
  burned,
}: {
  part: PlacedCustomPart;
  lit: boolean;
  brightness: number;
  burned: boolean;
}) {
  switch (part.type) {
    case "led_red":
      return <LedMesh color="#ff3b30" lit={lit} brightness={brightness} burned={burned} />;
    case "led_green":
      return <LedMesh color="#34d058" lit={lit} brightness={brightness} burned={burned} />;
    case "res_220":
      return <ResistorMesh bands={["#e5484d", "#e5484d", "#8b4513"]} />;
    case "res_10":
      return <ResistorMesh bands={["#8b4513", "#141414", "#141414"]} />;
    case "res_10k":
      return <ResistorMesh bands={["#8b4513", "#141414", "#e07b00"]} />;
    case "button":
      return <ButtonMesh />;
    case "npn_2n2222":
      return <NpnMesh />;
    case "diode_1n4007":
      return <DiodeMesh />;
    default:
      return null;
  }
}

/* ------------------------------- main view --------------------------------- */

type ViewportMode = "place" | "wire" | "probe" | "remove";

interface CustomViewportProps {
  mode: ViewportMode;
  /** Display label of the component armed for placement (place mode). */
  selectedLabel: string | null;
  parts: PlacedCustomPart[];
  wires: CustomWire[];
  simResult: CustomSimResult;
  powered: boolean;
  /** Pin chosen as the jumper-wire start (wire mode). */
  wireStartPin: string | null;
  probeReadout: string | null;
  /** Latest sandbox log lines, echoed in the 2D HUD (never inside <Canvas>). */
  hudLines: string[];
  onPinClick: (pinId: string) => void;
  onRemovePart: (partId: string) => void;
  onRemoveWire: (wireId: string) => void;
}

export default function CustomViewport({
  mode,
  selectedLabel,
  parts,
  wires,
  simResult,
  powered,
  wireStartPin,
  probeReadout,
  hudLines,
  onPinClick,
  onRemovePart,
  onRemoveWire,
}: CustomViewportProps) {
  const removeArmed = mode === "remove";
  const [hoverPin, setHoverPin] = useState<string | null>(null);
  const [hoverPart, setHoverPart] = useState<PlacedCustomPart | null>(null);
  const [hoverWire, setHoverWire] = useState<string | null>(null);

  const servoPart = parts.find((p) => p.type === "sg90_servo");
  const oledPart = parts.find((p) => p.type === "oled_i2c");

  /** Seated part on the breadboard (servo & OLED dock in the bay instead). */
  const renderBreadboardPart = (part: PlacedCustomPart) => {
    const span = PART_LEG_COUNT[part.type];
    const bodyCenterX = colX(part.gridCol) + ((span - 1) * COL_SPACING) / 2;
    const lit = simResult.litLedIds.includes(part.id);
    const brightness = simResult.ledBrightness[part.id] ?? 0;
    const burned = simResult.burnedPartIds.includes(part.id);
    return (
      <group
        key={part.id}
        position={[bodyCenterX, 0, rowZ(part.gridRow)]}
        onPointerDown={(e) => {
          if (!removeArmed) return;
          e.stopPropagation();
          onRemovePart(part.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoverPart(part);
        }}
        onPointerOut={() => setHoverPart(null)}
      >
        {removeArmed && hoverPart?.id === part.id && <SelectionRing y={0.42} />}
        {burned && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.415, 0]}>
            <circleGeometry args={[0.55, 24]} />
            <meshBasicMaterial color="#211d19" transparent opacity={0.5} />
          </mesh>
        )}
        <PartBody part={part} lit={lit} brightness={brightness} burned={burned} />
      </group>
    );
  };

  /** Bay-docked part (SG90 servo / OLED), also removable in remove mode. */
  const renderBayPart = (
    part: PlacedCustomPart,
    position: [number, number, number],
    active: boolean,
  ) => (
    <group
      key={part.id}
      position={position}
      onPointerDown={(e) => {
        if (!removeArmed) return;
        e.stopPropagation();
        onRemovePart(part.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoverPart(part);
      }}
      onPointerOut={() => setHoverPart(null)}
    >
      {removeArmed && hoverPart?.id === part.id && <SelectionRing y={0.02} />}
      {part.type === "sg90_servo" ? (
        <ServoRig active={active} />
      ) : (
        <OledRig active={active} />
      )}
    </group>
  );

  const hoverTooltip = hoverPart
    ? `${hoverPart.name} · col ${hoverPart.gridCol} (${hoverPart.gridRow})${
        removeArmed ? " — click to remove" : ""
      }`
    : hoverWire
      ? "Jumper wire — click to remove"
      : hoverPin
        ? `Pin · ${hoverPin}`
        : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ── 2D HUD overlay (strictly outside the Canvas) ────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-10 font-mono text-[11px] leading-snug">
        <div className="absolute left-3 top-3 max-w-[320px] rounded-md border border-white/10 bg-[#161614]/85 px-3 py-2 text-[#EAE6DF] shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: powered ? "#22c55e" : "#6b7280" }}
            />
            Mode · {mode.toUpperCase()}
          </div>
          <div className="mt-0.5 text-[#c8c4bc]">
            {mode === "place" &&
              (selectedLabel
                ? `Placing: ${selectedLabel}`
                : "Select a component in the palette")}
            {mode === "wire" &&
              (wireStartPin
                ? `Start: ${wireStartPin} → click destination`
                : "Click a start pin on the board")}
            {mode === "probe" && "Click any pin to read its voltage"}
            {mode === "remove" && "Click a part or wire to delete it"}
          </div>
        </div>

        <div className="absolute right-3 top-3 max-w-[340px] rounded-md border border-white/10 bg-[#161614]/85 px-3 py-2 text-[#EAE6DF] shadow-lg backdrop-blur">
          <div className="font-bold uppercase tracking-wide">
            Status · {simResult.status}
          </div>
          {simResult.faultMessage ? (
            <div className="mt-0.5 text-[#ff8484]">⚠ {simResult.faultMessage}</div>
          ) : (
            <div className="mt-0.5 text-[#c8c4bc]">
              {simResult.litLedIds.length
                ? `${simResult.litLedIds.length} LED lit`
                : "no LEDs lit"}
              {simResult.servoActive ? " · servo sweeping" : ""}
              {simResult.oledActive ? " · OLED live" : ""}
            </div>
          )}
        </div>

        {probeReadout && (
          <div className="absolute left-3 top-[86px] rounded-md border border-[#f59e0b]/40 bg-[#161614]/85 px-3 py-1.5 text-[#fbbf24] shadow-lg backdrop-blur">
            🔎 {probeReadout}
          </div>
        )}

        {hoverTooltip && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#161614]/85 px-3 py-1.5 text-[#EAE6DF] shadow-lg backdrop-blur">
            {hoverTooltip}
          </div>
        )}

        <div className="absolute bottom-3 left-3 max-w-[460px] rounded-md border border-white/10 bg-[#161614]/85 px-3 py-2 text-[#b8b4ac] shadow-lg backdrop-blur">
          {hudLines.slice(-4).map((l, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3D scene ────────────────────────────────────────────────────── */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [2, 13.5, 21], fov: 42, near: 0.1, far: 300 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        {/* warm cream studio backdrop (matches Viewport3D's stage) */}
        <color attach="background" args={["#EAE6DF"]} />
        {/* bright studio lighting for breadboard plastics, gold pins & parts */}
        <ambientLight intensity={1.1} />
        <directionalLight
          position={[6, 10, 8]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-6, 8, -6]} intensity={0.7} />
        <pointLight position={[15.3, 5, 0]} intensity={0.35} distance={14} />

        {/* workbench base */}
        <mesh position={[0, -0.3, 0]} receiveShadow>
          <boxGeometry args={[40, 0.6, 25]} />
          <meshStandardMaterial color="#cfc9bd" roughness={0.85} />
        </mesh>

        {/* Breadboard */}
        <Breadboard onPinClick={onPinClick} onHoverPin={setHoverPin} />

        {/* Arduino header strip – left side (blue PCB + gold pin header) */}
        <group position={[-14.5, 0, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.12, 5.6]} />
            <meshStandardMaterial color="#1f6fb2" roughness={0.6} />
          </mesh>
          {[
            "uno_5V",
            "uno_3V3",
            "uno_GND",
            "uno_D9",
            "uno_D13",
            "uno_SDA",
            "uno_SCL",
          ].map((pin, i) => (
            <mesh
              key={pin}
              position={[0, 0.55, 2.25 - i * 0.75]}
              castShadow
              onPointerDown={(e) => {
                e.stopPropagation();
                onPinClick(pin);
              }}
            >
              <cylinderGeometry args={[0.09, 0.09, 0.35, 10]} />
              <primitive object={pinMaterial} attach="material" />
            </mesh>
          ))}
          {/* power indicator LED on the header strip */}
          <mesh position={[0.28, 0.42, 2.6]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial
              color="#22c55e"
              emissive="#22c55e"
              emissiveIntensity={powered ? 1.3 : 0.06}
            />
          </mesh>
        </group>

        {/* Right docking bay platform (servo + OLED live here) */}
        <mesh position={[15.3, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[8.5, 0.4, 7]} />
          <meshStandardMaterial color="#b9b2a4" roughness={0.8} />
        </mesh>

        {/* Placed parts on the breadboard */}
        {parts.filter((p) => !BAY_TYPES.includes(p.type)).map(renderBreadboardPart)}

        {/* Bay-docked parts */}
        {servoPart &&
          renderBayPart(servoPart, SERVO_BAY, simResult.servoActive && powered)}
        {oledPart &&
          renderBayPart(oledPart, OLED_BAY, simResult.oledActive && powered)}

        {/* Jumper wires */}
        {wires.map((wire) => (
          <Wire
            key={wire.id}
            from={resolvePin(wire.fromPinId)}
            to={resolvePin(wire.toPinId)}
            color={wire.color}
            isActive={simResult.activeWireIds.includes(wire.id)}
            isShorted={simResult.shortedWireIds.includes(wire.id)}
            removable={removeArmed}
            highlighted={removeArmed && hoverWire === wire.id}
            onHover={(h) => setHoverWire(h ? wire.id : null)}
            onRemove={() => onRemoveWire(wire.id)}
          />
        ))}

        {/* Jumper start-pin marker (wire mode) */}
        {mode === "wire" && wireStartPin && (
          <mesh position={resolvePin(wireStartPin).add(new THREE.Vector3(0, 0.2, 0))}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        )}

        <OrbitControls
          makeDefault
          target={[1.5, 0.5, 0]}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={70}
        />
      </Canvas>
    </div>
  );
}

