// The 3D "studio": camera, lights, soft shadow under the board and mouse orbit controls.
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Board3D } from "./Board3D";

export default function Stage3D() {
  return (
    <div className="relative h-[480px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <Canvas
        shadows
        camera={{ position: [8.5, 8, 10.5], fov: 30 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.8} />
        <hemisphereLight args={["#ffffff", "#b8b0a0", 0.5]} />
        <directionalLight
          position={[6, 11, 5]}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
        />
        <Board3D />
        <ContactShadows
          position={[0, -0.29, 0]}
          opacity={0.4}
          scale={22}
          blur={2.4}
          far={3}
        />
        <OrbitControls
          enablePan={false}
          minDistance={7}
          maxDistance={22}
          maxPolarAngle={Math.PI / 2.15}
        />
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-3 text-xs opacity-60">
        Drag to orbit · scroll to zoom · click a part to place or remove it
      </p>
    </div>
  );
}
