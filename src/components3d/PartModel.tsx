// ─────────────────────────────────────────────────────────────────────────────
// What each kind of part LOOKS like in 3D, built from boxes, cylinders and spheres.
// The model is centred on (0, 0, 0) with its base at y = 0; Part3D places it.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshPhysicalMaterial, PointLight } from "three";
import type { PartDefinition } from "../data/types";
import { UNIT } from "../render3d/scene";

export const METAL = "#c9ccd2",
  GOLD = "#d8b04a";
type Vec3 = [number, number, number];

function Box({
  size,
  position = [0, 0, 0],
  color,
  metal = false,
}: {
  size: Vec3;
  position?: Vec3;
  color: string;
  metal?: boolean;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={metal ? 0.3 : 0.6}
        metalness={metal ? 0.8 : 0.05}
      />
    </mesh>
  );
}

function Cyl({
  radius,
  height,
  position = [0, 0, 0],
  color,
  metal = false,
}: {
  radius: number;
  height: number;
  position?: Vec3;
  color: string;
  metal?: boolean;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 24]} />
      <meshStandardMaterial
        color={color}
        roughness={metal ? 0.3 : 0.6}
        metalness={metal ? 0.8 : 0.05}
      />
    </mesh>
  );
}

/** Glass-like material that lights up (and blinks) when its part is lit. */
function GlowMaterial({
  color,
  isLit,
  isBlinking,
}: {
  color: string;
  isLit: boolean;
  isBlinking: boolean;
}) {
  const material = useRef<MeshPhysicalMaterial>(null);
  useFrame(({ clock }) => {
    if (!material.current) return;
    const isOn =
      isLit && (!isBlinking || Math.floor(clock.elapsedTime * 2) % 2 === 0);
    material.current.emissiveIntensity = isOn ? 2.4 : 0;
  });
  return (
    <meshPhysicalMaterial
      ref={material}
      color={color}
      emissive={color}
      emissiveIntensity={0}
      transparent
      opacity={0.92}
      roughness={0.15}
    />
  );
}

/** A real light source next to a glowing LED, so it lights the board around it. */
function GlowLight({
  color,
  isLit,
  isBlinking,
  position,
}: {
  color: string;
  isLit: boolean;
  isBlinking: boolean;
  position: Vec3;
}) {
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const isOn =
      isLit && (!isBlinking || Math.floor(clock.elapsedTime * 2) % 2 === 0);
    light.current.intensity = isOn ? 2.5 : 0;
  });
  return (
    <pointLight
      ref={light}
      color={color}
      intensity={0}
      distance={3}
      position={position}
    />
  );
}

interface PartModelProps {
  part: PartDefinition;
  isLit: boolean;
  isBlinking: boolean;
}

export function PartModel({ part, isLit, isBlinking }: PartModelProps) {
  const width = part.width * UNIT,
    depth = part.depth * UNIT,
    height = part.height * UNIT;
  const glow = part.glowColor ?? "#ffffff";
  const pinCount = part.pinCount ?? 4;
  const spinner = useRef<Group>(null);
  useFrame((_, delta) => {
    if (spinner.current && isLit)
      spinner.current.rotation.y += Math.min(delta, 0.05) * 14;
  }); // motors spin while running

  switch (part.kind) {
    case "resistor": {
      // capsule body lying along X, colour bands, and bent metal leads
      const radius = Math.min(depth * 0.42, 0.22),
        bodyY = radius + 0.14;
      return (
        <group>
          <mesh
            position={[0, bodyY, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <capsuleGeometry args={[radius, width * 0.55, 6, 16]} />
            <meshStandardMaterial color={part.color} roughness={0.6} />
          </mesh>
          {(part.bands ?? []).map((bandColor, i) => (
            <mesh
              key={i}
              position={[-width * 0.16 + i * width * 0.11, bodyY, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry
                args={[radius * 1.04, radius * 1.04, 0.07, 16]}
              />
              <meshStandardMaterial color={bandColor} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh
                position={[side * width * 0.4, bodyY, 0]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.025, 0.025, width * 0.2, 8]} />
                <meshStandardMaterial
                  color={METAL}
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
              <Cyl
                radius={0.025}
                height={bodyY}
                position={[side * width * 0.5, bodyY / 2, 0]}
                color={METAL}
                metal
              />
            </group>
          ))}
        </group>
      );
    }
    case "led": {
      // flange, round body and a glowing dome
      const radius = width * 0.42;
      return (
        <group>
          {[-1, 1].map((side) => (
            <Cyl
              key={side}
              radius={0.025}
              height={0.2}
              position={[side * radius * 0.5, 0.1, 0]}
              color={METAL}
              metal
            />
          ))}
          <Cyl
            radius={radius * 1.22}
            height={0.07}
            position={[0, 0.235, 0]}
            color={part.color}
          />
          <mesh position={[0, 0.27 + height * 0.25, 0]} castShadow>
            <cylinderGeometry args={[radius, radius, height * 0.5, 24]} />
            <GlowMaterial
              color={part.glowColor ?? part.color}
              isLit={isLit}
              isBlinking={isBlinking}
            />
          </mesh>
          <mesh position={[0, 0.27 + height * 0.5, 0]} castShadow>
            <sphereGeometry
              args={[radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <GlowMaterial
              color={part.glowColor ?? part.color}
              isLit={isLit}
              isBlinking={isBlinking}
            />
          </mesh>
          <GlowLight
            color={glow}
            isLit={isLit}
            isBlinking={isBlinking}
            position={[0, height + 0.3, 0]}
          />
        </group>
      );
    }
    case "capacitor": // electrolytic can with a silver top
      return (
        <group>
          <Cyl
            radius={Math.min(width, depth) * 0.5}
            height={height}
            position={[0, height / 2, 0]}
            color={part.color}
          />
          <Cyl
            radius={Math.min(width, depth) * 0.4}
            height={0.02}
            position={[0, height + 0.01, 0]}
            color={METAL}
            metal
          />
        </group>
      );
    case "header": // black plastic strip with gold pins
      return (
        <group>
          <Box
            size={[width, 0.22, depth]}
            position={[0, 0.11, 0]}
            color={part.color}
          />
          {Array.from({ length: pinCount }, (_, i) => (
            <Box
              key={i}
              size={[0.07, 0.38, 0.07]}
              position={[-width / 2 + ((i + 0.5) * width) / pinCount, 0.34, 0]}
              color={GOLD}
              metal
            />
          ))}
        </group>
      );
    case "chip": {
      // black package with a row of pins down both long sides and a pin-1 dot
      const pinsPerSide =
        part.pinCount ?? Math.max(4, Math.round(part.width / 7));
      return (
        <group>
          <Box
            size={[width, height, depth]}
            position={[0, height / 2 + 0.05, 0]}
            color={part.color}
          />
          {Array.from({ length: pinsPerSide }, (_, i) =>
            [-1, 1].map((side) => (
              <Box
                key={`${i}${side}`}
                size={[0.07, 0.05, 0.14]}
                position={[
                  -width / 2 + ((i + 0.5) * width) / pinsPerSide,
                  0.06,
                  side * (depth / 2 + 0.05),
                ]}
                color={METAL}
                metal
              />
            )),
          )}
          <Cyl
            radius={0.06}
            height={0.01}
            position={[-width / 2 + 0.2, height + 0.1, -depth / 2 + 0.2]}
            color="#ffffff"
          />
        </group>
      );
    }
    case "terminal": {
      // green screw terminal with a round screw head per wire
      const screws = part.pinCount ?? 2;
      return (
        <group>
          <Box
            size={[width, height, depth]}
            position={[0, height / 2, 0]}
            color={part.color}
          />
          {Array.from({ length: screws }, (_, i) => (
            <Cyl
              key={i}
              radius={Math.min(depth * 0.3, 0.16)}
              height={0.05}
              position={[
                -width / 2 + ((i + 0.5) * width) / screws,
                height + 0.025,
                0,
              ]}
              color={METAL}
              metal
            />
          ))}
        </group>
      );
    }
    case "heatsink": {
      // thin base plate with tall parallel fins
      const fins = Math.max(2, Math.floor(part.width / 6));
      return (
        <group>
          <Box
            size={[width, 0.12, depth]}
            position={[0, 0.06, 0]}
            color={part.color}
            metal
          />
          {Array.from({ length: fins }, (_, i) => (
            <Box
              key={i}
              size={[0.1, height, depth]}
              position={[
                -width / 2 + 0.12 + (i * (width - 0.24)) / (fins - 1),
                0.12 + height / 2,
                0,
              ]}
              color={part.color}
              metal
            />
          ))}
        </group>
      );
    }
    case "relay": // blue cube with a white label
      return (
        <group>
          <Box
            size={[width, height, depth]}
            position={[0, height / 2, 0]}
            color={part.color}
          />
          <Box
            size={[width * 0.8, 0.01, depth * 0.8]}
            position={[0, height + 0.005, 0]}
            color="#e9ecef"
          />
        </group>
      );
    case "motor": // metal can, a shaft, and a marker that spins while running
      return (
        <group>
          <Cyl
            radius={width / 2}
            height={height * 0.8}
            position={[0, height * 0.4, 0]}
            color={part.color}
            metal
          />
          <Cyl
            radius={width * 0.36}
            height={0.03}
            position={[0, height * 0.8 + 0.015, 0]}
            color="#8a9099"
            metal
          />
          <Cyl
            radius={0.08}
            height={0.3}
            position={[0, height * 0.8 + 0.15, 0]}
            color={METAL}
            metal
          />
          <group ref={spinner} position={[0, height * 0.8 + 0.05, 0]}>
            <Box size={[width * 0.5, 0.03, 0.08]} color="#ffffff" />
          </group>
        </group>
      );
    case "eye": // ultrasonic transducer: metal can, dark mesh face, glowing ring when active
      return (
        <group>
          <Cyl
            radius={width / 2}
            height={height}
            position={[0, height / 2, 0]}
            color={part.color}
            metal
          />
          <Cyl
            radius={width * 0.36}
            height={0.02}
            position={[0, height + 0.01, 0]}
            color="#2a2d33"
          />
          <mesh
            position={[0, height + 0.03, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[width * 0.38, width * 0.46, 24]} />
            <GlowMaterial color={glow} isLit={isLit} isBlinking={false} />
          </mesh>
        </group>
      );
    default: // connector / block: a plain box; connectors get a dark opening, light-emitting blocks a glowing lens
      return (
        <group>
          <Box
            size={[width, height, depth]}
            position={[0, height / 2, 0]}
            color={part.color}
            metal={part.kind === "connector"}
          />
          {(part.hasWindow ?? part.kind === "connector") && (
            <Box
              size={[width * 0.72, height * 0.55, 0.02]}
              position={[0, height * 0.5, depth / 2 + 0.005]}
              color="#101010"
            />
          )}
          {part.glowColor && (
            <mesh
              position={[0, height + 0.01, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[Math.min(width, depth) * 0.25, 20]} />
              <GlowMaterial
                color={glow}
                isLit={isLit}
                isBlinking={isBlinking}
              />
            </mesh>
          )}
        </group>
      );
  }
}
