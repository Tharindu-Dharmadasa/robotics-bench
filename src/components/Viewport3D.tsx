import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import type * as THREE from "three";

import { AnimatedPart, Pcb, SolderJoints, UsbCable } from "./PartGeometry";
import { COLORS, PCB_T } from "../data/boards";
import type { BoardSpec, Part, SimStatus } from "../types/simulator";

/* ---------- Optional .glb model support ---------- */

function GlbBoardModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

type GlbBoardFallbackProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
};

class GlbBoardFallback extends Component<
  GlbBoardFallbackProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[GlbBoardFallback] procedural scene engaged:", error);
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ---------- Fault visual effects ---------- */

const SMOKE_COUNT = 6;

/**
 * Glowing / charred shell over the damaged part plus rising translucent gray
 * smoke spheres. Only plain meshes are used (no drei <Html>/<Text>).
 */
function FaultOverlay({
  part,
  explode,
  damaged,
}: {
  part: Part;
  explode: number;
  damaged: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const smoke = useRef<THREE.Group>(null);
  const layer = part.smd ? 1 : part.kind === "hdr" ? 3 : 2;

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // Ease the whole overlay down onto the part (and follow the exploded view).
    const ty = PCB_T / 2 + explode * layer * 1.1;
    const k = 1 - Math.exp(-dt * 7);
    g.position.y += (ty - g.position.y) * k;
    g.scale.setScalar(g.scale.x + (1 - g.scale.x) * k);

    // Pulsing red-hot glow on the charred shell.
    const pulse = 1.4 + Math.sin(t * 9) * 0.6;
    if (shell.current) {
      const m = shell.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = pulse;
    }
    if (glow.current) glow.current.intensity = 1.2 + Math.sin(t * 9) * 0.5;

    // Rising, drifting, fading smoke.
    if (smoke.current) {
      smoke.current.children.forEach((c, i) => {
        const phase = (t * 0.35 + i / SMOKE_COUNT) % 1;
        c.position.y = 0.25 + phase * 1.7;
        c.position.x = Math.sin((t + i * 2) * 1.7) * 0.12;
        c.position.z = Math.cos((t + i * 1.3) * 1.3) * 0.08;
        c.scale.setScalar((0.1 + phase * 0.28) / 0.16);
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.opacity = 0.34 * (1 - phase);
      });
    }
  });

  return (
    <group ref={root} position={[part.p[0], 7, part.p[1]]} scale={0.001}>
      {damaged && (
        <>
          {/* charred body */}
          <mesh ref={shell} position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.3, 20, 16]} />
            <meshStandardMaterial
              color="#1a0a08"
              emissive="#ff2a1a"
              emissiveIntensity={1.4}
              roughness={0.95}
            />
          </mesh>
          {/* soot ring on the board */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 0.46, 24]} />
            <meshStandardMaterial
              color="#0d0807"
              transparent
              opacity={0.75}
              depthWrite={false}
            />
          </mesh>
          <pointLight
            ref={glow}
            position={[0, 0.4, 0]}
            color="#ff5533"
            intensity={1.6}
            distance={2.2}
          />
        </>
      )}
      <group ref={smoke}>
        {Array.from({ length: SMOKE_COUNT }, (_, i) => (
          <mesh key={i} position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.16, 14, 12]} />
            <meshStandardMaterial
              color="#8a8a8a"
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------- Viewport ---------- */

interface Viewport3DProps {
  spec: BoardSpec;
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
  fault: string | null;
  hover: string | null;
  onHover: (label: string | null) => void;
  onGlbFallback: () => void;
}

export default function Viewport3D({
  spec,
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
  fault,
  hover,
  onHover,
  onGlbFallback,
}: Viewport3DProps) {
  const [glbUrl, setGlbUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setGlbUrl(null);
    const url = `/models/fig-${String(spec.id).padStart(2, "0")}.glb`;
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (
          alive &&
          res.ok &&
          !(res.headers.get("content-type") ?? "").includes("text/html")
        ) {
          setGlbUrl(url);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [spec.id]);

  // The part that burns out for the active board's faultRule.
  const damagedPart =
    fault && spec.faultRule
      ? parts.find((p) => p.id === spec.faultRule!.criticalPart)
      : undefined;
  const hasUsbPort = parts.some((p) => p.kind === "usb");

  // Solder joints follow only the parts that are actually on the board.
  const placedParts = parts.filter((p) => placed.has(p.id));

  const procedural = (
    <>
      <Pcb
        color={COLORS[color]}
        explode={explode}
        generic={parts.length === 0 ? spec.name : undefined}
      />
      {parts.length > 0 && (
        <>
          <SolderJoints show={soldered} explode={explode} parts={placedParts} />
          {parts.map((p) => (
            <AnimatedPart
              key={`${spec.id}-${p.id}`}
              part={p}
              placed={placed.has(p.id)}
              explode={explode}
              lit={litMap(p.id)}
              onHover={onHover}
            />
          ))}
          {usb && hasUsbPort && <UsbCable plugged={usb} explode={explode} />}
        </>
      )}
    </>
  );

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
        {glbUrl ? (
          <GlbBoardFallback
            key={glbUrl}
            fallback={procedural}
            onError={onGlbFallback}
          >
            <Suspense fallback={procedural}>
              <GlbBoardModel url={glbUrl} />
            </Suspense>
          </GlbBoardFallback>
        ) : (
          procedural
        )}
        {/* Fault effects render for both the procedural scene and a loaded .glb */}
        {damagedPart && (
          <FaultOverlay
            key={`${spec.id}-${damagedPart.id}-fault`}
            part={damagedPart}
            explode={explode}
            damaged={placed.has(damagedPart.id)}
          />
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
        <OrbitControls makeDefault enableDamping minZoom={25} maxZoom={150} />
      </Canvas>
      <div className="pointer-events-none absolute right-5 top-4 text-right">
        <div className="text-[10px] tracking-widest text-[#666]">PARTS</div>
        <div className="text-4xl font-bold">
          {count}/{total}
        </div>
        <div className="mt-1 text-[10px] tracking-widest text-[#666]">
          STATUS
        </div>
        <div
          className={`text-xl font-bold ${status === "RUNNING" ? "text-green-700" : status === "FAULT" ? "text-red-700" : ""}`}
        >
          {status}
        </div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-[#222] bg-[#f5efd9] px-3 py-1 text-xs">
          {hover}
        </div>
      )}
    </div>
  );
}
