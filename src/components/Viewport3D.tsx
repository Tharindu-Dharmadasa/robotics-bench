import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";

import { AnimatedPart, Pcb, SolderJoints, UsbCable } from "./PartGeometry";
import { COLORS } from "../data/boards";
import type { BoardSpec, Part, SimStatus } from "../types/simulator";

interface Viewport3DProps {
  spec: BoardSpec;
  isUno: boolean;
  parts: Part[];
  placed: Set<string>;
  soldered: boolean;
  usb: boolean;
  explode: number;
  color: string;
  litMap: (id: string) => boolean;
  count: number;
  total: number;
  status: SimStatus;
  hover: string | null;
  onHover: (label: string | null) => void;
}

export default function Viewport3D({
  spec,
  isUno,
  parts,
  placed,
  soldered,
  usb,
  explode,
  color,
  litMap,
  count,
  total,
  status,
  hover,
  onHover,
}: Viewport3DProps) {
  return (
    <div className="relative min-w-0 flex-1">
      <Canvas
        shadows
        orthographic
        camera={{ position: [10, 10, 10], zoom: 55 }}
      >
        <color attach="background" args={["#EAE6DF"]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[5, 10, 4]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <directionalLight position={[-6, 4, -3]} intensity={0.4} />
        {isUno ? (
          <group>
            <Pcb color={COLORS[color]} explode={explode} />
            <SolderJoints show={soldered} explode={explode} parts={parts} />
            {parts.map((p) => (
              <AnimatedPart
                key={p.id}
                part={p}
                placed={placed.has(p.id)}
                explode={explode}
                lit={litMap(p.id)}
                onHover={onHover}
              />
            ))}
            <UsbCable plugged={usb} explode={explode} />
          </group>
        ) : (
          <Pcb color={COLORS[color]} explode={explode} generic={spec.name} />
        )}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -1.6, 0]}
          receiveShadow
        >
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.15} />
        </mesh>
        <ContactShadows
          position={[0, -1.59, 0]}
          opacity={0.35}
          scale={20}
          blur={2.5}
          far={4}
        />
        <OrbitControls
          makeDefault
          enableDamping
          minZoom={25}
          maxZoom={150}
        />
      </Canvas>
      <div className="pointer-events-none absolute right-5 top-4 text-right">
        <div className="text-[10px] tracking-widest text-[#666]">PARTS</div>
        <div className="text-4xl font-bold">
          {isUno ? count : 12}/{isUno ? total : 12}
        </div>
        <div className="mt-1 text-[10px] tracking-widest text-[#666]">
          STATUS
        </div>
        <div
          className={`text-xl font-bold ${status === "RUNNING" ? "text-green-700" : ""}`}
        >
          {isUno ? status : "READY"}
        </div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-[#222] bg-[#f5efd9] px-3 py-1 text-xs">
          {hover}
        </div>
      )}
      {!isUno && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-[#222] bg-[#f5efd9] px-3 py-1 text-xs">
          Preview only — Fig. 01 is fully playable
        </div>
      )}
    </div>
  );
}
