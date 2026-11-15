import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Wrench } from "lucide-react";
import * as THREE from "three";

import {
  AnimatedPart,
  Pcb,
  SolderJoints,
  UsbCable,
  matchGlbPart,
  normPartName,
} from "./PartGeometry";
import { COLORS, PCB_T } from "../data/boards";
import type { BoardSpec, FaultSeverity, Part, SimStatus } from "../types/simulator";

/**
 * Structured fault raised by the bench (removal, unsafe value or power-on
 * with an incomplete board). Drives both the 2D HUD banner and the 3D
 * burn-out visuals.
 */
export interface EduFault {
  /** The part the learner interacted with (removed / re-valued). */
  partId: string;
  /** Name shown as BROKEN COMPONENT on the HUD banner. */
  partName: string;
  severity: FaultSeverity;
  /** WHY IT BROKE — the electronics learning note. */
  message: string;
  /** Part that visually burns out (red glow + smoke), if any. */
  burnPartId?: string;
}

/* ---------- Studio environment (procedural, no HDRI download) ---------- */

function StudioEnvironment() {
  return (
    // Rendered once into a cube map; Lightformers are the "softboxes".
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#34343a"]} />
      {/* big overhead softbox */}
      <Lightformer
        form="rect"
        intensity={3.2}
        color="#ffffff"
        position={[0, 6, 0]}
        rotation-x={Math.PI / 2}
        scale={[12, 12, 1]}
      />
      {/* key strip, camera-left */}
      <Lightformer
        form="rect"
        intensity={3}
        color="#fff6ea"
        position={[-7, 2.5, 3]}
        rotation-y={Math.PI / 2}
        scale={[9, 2.5, 1]}
      />
      {/* cool rim strip, back-right */}
      <Lightformer
        form="rect"
        intensity={2.6}
        color="#cfe4ff"
        position={[7, 1.5, -3]}
        rotation-y={-Math.PI / 2}
        scale={[7, 1.8, 1]}
      />
      {/* long back strip for edge highlights on metal shells */}
      <Lightformer
        form="rect"
        intensity={2}
        color="#ffffff"
        position={[0, 2, -8]}
        scale={[14, 1.4, 1]}
      />
      {/* warm front fill */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#ffe6c8"
        position={[0, 1.2, 8]}
        rotation-y={Math.PI}
        scale={[10, 1.2, 1]}
      />
      {/* small hot spot: crisp glints on gold pins, solder cones, IC lids */}
      <Lightformer
        form="circle"
        intensity={9}
        color="#ffffff"
        position={[3, 6, 3]}
        rotation-x={Math.PI / 2}
        scale={1.8}
      />
      {/* floor bounce matching the backdrop colour */}
      <Lightformer
        form="rect"
        intensity={0.7}
        color="#EAE6DF"
        position={[0, -5, 0]}
        rotation-x={-Math.PI / 2}
        scale={[16, 16, 1]}
      />
    </Environment>
  );
}

/* ---------- Real multi-part .glb board ---------- */

type GlbEntry = {
  key: string; // node uuid
  node: THREE.Mesh;
  label: string; // cleaned mesh name for the HUD
  part: Part | null; // matched board part; null = unmapped CAD component
  isBase: boolean; // static board geometry: never removed or highlighted
  mat: THREE.MeshStandardMaterial | null; // cloned material for hover highlight
  rest: THREE.Vector3; // rest world position
  pivot: THREE.Vector3; // own centre, used to scale in place
  baseScale: THREE.Vector3;
  dist: number; // XZ distance from board centre (drives the exploded lift)
  dy: number;
  s: number;
};

/** "USB_B_port.001" -> "USB B port", for the hover HUD. */
const cleanMeshName = (raw: string) =>
  raw
    .replace(/\.\d{3}$/, "")
    .replace(/[_\-.]+/g, " ")
    .trim();

/** Node names that mean "this is the board itself", not a component. */
const isBaseName = (raw: string) => /pcb|board|base|fr4/.test(normPartName(raw));

/**
 * Loads /models/fig-XX.glb and re-fits it to the bench:
 *  1. the scene is cloned (useMemo) and rotated -90° about X so CAD models
 *     authored Z-up lie flat in the bench's Y-up space;
 *  2. the longest bounding-box axis is uniformly scaled to 6.9 units, X/Z are
 *     centred at 0 and the bottom rests flush at y = 0;
 *  3. every sub-mesh whose name matches pcb|board|base|fr4 — or that has the
 *     largest X×Z footprint — is the static PCB base; every other named mesh
 *     is an interactive component that can be hovered, exploded, stripped and
 *     toggled off/on the board with a click (a clicked-off part hovers just
 *     above its socket until it is clicked back in).
 */
function RealGlbBoard({
  url,
  parts,
  placed,
  explode,
  onHover,
  onRemovePart,
}: {
  url: string;
  parts: Part[];
  placed: Set<string>;
  explode: number;
  onHover: (label: string | null) => void;
  /** Removing a matched, placed part is authoritative in App state. */
  onRemovePart: (id: string) => void;
}) {
  const { scene } = useGLTF(url);
  const wrapper = useRef<THREE.Group>(null);
  const ready = useRef(false);
  const removedRef = useRef(new Set<string>()); // click-to-remove toggles
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  // Clone + lay flat: CAD exports are usually Z-up, the bench is Y-up.
  const root = useMemo(() => {
    const c = scene.clone(true);
    c.rotation.x = -Math.PI / 2;
    c.updateMatrixWorld(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // Uniform fit: longest bounding-box axis -> 6.9, centred on X/Z, bottom
  // resting flush at y = 0.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z);
    const sc = Number.isFinite(span) && span > 0 ? 6.9 / span : 1;
    console.info(
      `[RealGlbBoard] ${url} fitted: ` +
        size
          .toArray()
          .map((v) => (v * sc).toFixed(2))
          .join(" × ") +
        " units",
    );
    return {
      scale: sc,
      position: [
        -ctr.x * sc,
        -box.min.y * sc,
        -ctr.z * sc,
      ] as [number, number, number],
    };
  }, [root, url]);

  // One entry per sub-mesh. Name matches pcb|board|base|fr4, an unnamed mesh,
  // or the largest X×Z footprint -> static PCB base; every other named mesh is
  // an interactive, removable component (matched to a board part when possible).
  const { entries, entryMap } = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });

    const areas = meshes.map((m) => {
      const s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      return s.x * s.z;
    });
    const maxArea = Math.max(...areas);

    const entries: GlbEntry[] = [];
    const entryMap = new Map<string, GlbEntry>();
    meshes.forEach((m, i) => {
      const name = m.name.trim();
      const isBase = !name || isBaseName(name) || areas[i] >= maxArea;
      let part: Part | null = null;
      let mat: THREE.MeshStandardMaterial | null = null;
      if (!isBase) {
        part = matchGlbPart(name, parts);
        // own material clone so the hover highlight can't leak between meshes
        const src = Array.isArray(m.material) ? m.material[0] : m.material;
        if (src instanceof THREE.MeshStandardMaterial) {
          mat = src.clone();
          mat.emissive = new THREE.Color("#ffb020");
          mat.emissiveIntensity = 0;
          m.material = mat;
        }
      }
      const entry: GlbEntry = {
        key: m.uuid,
        node: m,
        label: cleanMeshName(name) || `part ${i + 1}`,
        part,
        isBase,
        mat,
        rest: new THREE.Vector3(),
        pivot: new THREE.Vector3(),
        baseScale: new THREE.Vector3(1, 1, 1),
        dist: 0,
        dy: 0,
        s: 1,
      };
      entries.push(entry);
      entryMap.set(m.uuid, entry);
    });
    return { entries, entryMap };
  }, [root, parts]);

  useEffect(() => {
    ready.current = false;
  }, [entries, fit]);

  useFrame((state, dt) => {
    const g = wrapper.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    if (!ready.current) {
      // capture the rest pose once the wrapper's transform is in the chain
      g.updateWorldMatrix(true, true);
      const b = new THREE.Box3();
      entries.forEach((e) => {
        e.node.getWorldPosition(e.rest);
        b.setFromObject(e.node);
        if (b.isEmpty()) e.pivot.copy(e.rest);
        else b.getCenter(e.pivot);
        e.baseScale.copy(e.node.scale);
        e.dist = Math.hypot(e.rest.x, e.rest.z);
        e.dy = 0;
        e.s = 1;
      });
      ready.current = true;
    }

    entries.forEach((e) => {
      // Strip to bare PCB (placed is empty) lifts everything but the base away
      // and resets click-toggles; the bench's placed state wins over them.
      const bare = placed.size === 0;
      if (bare) removedRef.current.clear();
      const stripped =
        !e.isBase &&
        (bare || (!!e.part && !placed.has(e.part.id)));
      const clickedOff = !e.isBase && removedRef.current.has(e.key);
      const k = 1 - Math.exp(-dt * (stripped ? 4 : 7));
      let ty = 0;
      let ts = 1;
      if (e.isBase) ty = -explode * 0.6; // board follows the PCB drop
      else if (stripped) {
        ty = 7; // stripped on the bench: lift up and shrink away
        ts = 0.001;
      } else if (clickedOff) {
        // clicked off: hover just above its socket — click again to refit it
        ty = 1.3;
        ts = 0.45;
      } else {
        // exploded view: the lift grows with the distance from board centre
        ty = explode * (0.9 + e.dist * 0.5);
      }

      e.dy = THREE.MathUtils.lerp(e.dy, ty, k);
      e.s = THREE.MathUtils.lerp(e.s, ts, k);

      // scale about the part's own centre, then lift in world space
      tmp.copy(e.rest).sub(e.pivot).multiplyScalar(e.s).add(e.pivot);
      tmp.y += e.dy;
      if (e.node.parent) e.node.parent.worldToLocal(tmp);
      e.node.position.copy(tmp);
      e.node.scale.copy(e.baseScale).multiplyScalar(e.s);
      e.node.visible = e.s > 0.02;

      // hover highlight: warm emissive pulse on the mesh under the cursor
      if (e.mat) {
        const target =
          !stripped && hoverKey === e.key ? 0.45 + Math.sin(t * 8) * 0.15 : 0;
        e.mat.emissiveIntensity = THREE.MathUtils.lerp(
          e.mat.emissiveIntensity,
          target,
          1 - Math.exp(-dt * 12),
        );
      }
    });
  });

  const entryOf = (o: THREE.Object3D | null): GlbEntry | undefined => {
    while (o) {
      const e = entryMap.get(o.uuid);
      if (e) return e;
      o = o.parent;
    }
    return undefined;
  };

  return (
    <group
      ref={wrapper}
      scale={fit.scale}
      position={fit.position}
      onPointerOver={(ev) => {
        const e = entryOf(ev.object);
        if (!e || e.isBase || !e.node.visible) return;
        ev.stopPropagation();
        setHoverKey(e.key);
        onHover(e.part ? e.part.name : e.label);
      }}
      onPointerOut={() => {
        setHoverKey(null);
        onHover(null);
      }}
      onClick={(ev) => {
        const e = entryOf(ev.object);
        if (!e || e.isBase) return;
        ev.stopPropagation();
        // A placed board part: lift-off removal is owned by App state.
        if (e.part && placed.has(e.part.id)) {
          onRemovePart(e.part.id);
          return;
        }
        const stripped = !!e.part && !placed.has(e.part.id);
        if (removedRef.current.has(e.key) || stripped)
          removedRef.current.delete(e.key);
        else removedRef.current.add(e.key);
      }}
    >
      <primitive object={root} />
    </group>
  );
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
  /** Structured fault driving the HUD banner + burn visuals. */
  eduFault: EduFault | null;
  /** Bench view: interactive procedural parts vs real CAD (.glb). */
  viewMode: "parts" | "cad";
  /** Click-to-remove a placed part directly on the 3D board. */
  onRemovePart: (id: string) => void;
  /** "Repair & Replace Part" quick-fix on the HUD banner. */
  onRepair: () => void;
  hover: string | null;
  onHover: (label: string | null) => void;
  onGlbFallback: () => void;
}

const SEVERITY_BADGE: Record<FaultSeverity, string> = {
  burnout: "bg-red-700 text-[#EAE6DF]",
  halt: "bg-[#8a2b2b] text-[#EAE6DF]",
  degraded: "bg-[#b3862a] text-[#181410]",
};

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
  eduFault,
  viewMode,
  onRemovePart,
  onRepair,
  hover,
  onHover,
  onGlbFallback,
}: Viewport3DProps) {
  const [glbUrl, setGlbUrl] = useState<string | null>(null);

  // Only try to load a .glb when the file really exists in public/models/
  // (Vite answers unknown paths with index.html, so the content-type is checked too).
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

  // The part that burns for the active fault (rule faults set burnPartId to
  // the faultRule's criticalPart; removal/value faults name the damaged part).
  const burnPart = eduFault?.burnPartId
    ? parts.find((p) => p.id === eduFault.burnPartId)
    : undefined;
  const hasUsbPort = parts.some((p) => p.kind === "usb");

  // Solder joints follow only the parts that are actually on the board.
  const placedParts = parts.filter((p) => placed.has(p.id));

  // Optional per-board pin labels for the silkscreen (falls back to Uno-style labels).
  const pinLabels = (spec as BoardSpec & { pinLabels?: string[] }).pinLabels;

  const procedural = (
    <>
      <Pcb
        color={COLORS[color]}
        explode={explode}
        generic={parts.length === 0 ? spec.name : undefined}
        boardName={spec.name}
        pinLabels={pinLabels}
      />
      {parts.length > 0 && (
        <>
          <SolderJoints show={soldered} explode={explode} parts={placedParts} />
          {parts.map((p) => (
            <group
              key={`${spec.id}-${p.id}-click`}
              onClick={(e) => {
                if (!placed.has(p.id)) return;
                e.stopPropagation();
                onRemovePart(p.id); // lift-off animation runs in AnimatedPart
              }}
            >
              <AnimatedPart
                part={p}
                placed={placed.has(p.id)}
                explode={explode}
                lit={litMap(p.id)}
                onHover={onHover}
              />
            </group>
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
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <color attach="background" args={["#EAE6DF"]} />
        <StudioEnvironment />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[5, 10, 4]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <directionalLight position={[-6, 4, -3]} intensity={0.3} />
        {viewMode === "cad" && glbUrl ? (
          <GlbBoardFallback
            key={glbUrl}
            fallback={procedural}
            onError={onGlbFallback}
          >
            <Suspense fallback={procedural}>
              <RealGlbBoard
                url={glbUrl}
                parts={parts}
                placed={placed}
                explode={explode}
                onHover={onHover}
                onRemovePart={onRemovePart}
              />
            </Suspense>
          </GlbBoardFallback>
        ) : (
          procedural
        )}
        {/* Burn-out effects render for both the procedural scene and a loaded .glb */}
        {burnPart && (
          <FaultOverlay
            key={`${spec.id}-${burnPart.id}-fault`}
            part={burnPart}
            explode={explode}
            damaged={placed.has(burnPart.id)}
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
      {eduFault && (
        <div className="absolute bottom-4 left-1/2 z-10 w-[min(480px,90%)] -translate-x-1/2 rounded-lg border-2 border-red-800 bg-[#181410]/95 p-3 text-[#EAE6DF] shadow-2xl backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] tracking-widest text-red-300">
                BROKEN COMPONENT
              </div>
              <div className="text-sm font-bold">{eduFault.partName}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[9px] tracking-widest text-[#9a8f86]">
                  WHAT HAPPENED
                </span>
                <span
                  className={`animate-pulse rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest ${SEVERITY_BADGE[eduFault.severity]}`}
                >
                  {eduFault.severity.toUpperCase()}
                </span>
              </div>
              <div className="mt-1.5 text-[9px] tracking-widest text-[#9a8f86]">
                WHY IT BROKE (LEARNING NOTE)
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[#d8d2c8]">
                {eduFault.message}
              </p>
            </div>
            <button
              onClick={onRepair}
              className="flex shrink-0 items-center gap-1 rounded-full border border-[#EAE6DF] px-2.5 py-1 text-[10px] font-bold transition hover:bg-[#EAE6DF] hover:text-[#181410]"
            >
              <Wrench size={11} /> Repair &amp; Replace Part
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
