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
  CurrentFlow,
  Pcb,
  SolderJoints,
  UsbCable,
  boardStyleOf,
  matchGlbPart,
  normPartName,
} from "./PartGeometry";
import CircuitWireOverlay from "./CircuitWireOverlay";
import { ky040Shaft } from "./boards/Fig10Encoder";
import { pca9685Pwm } from "./boards/Fig11PCA9685";
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

/* ---------- 4-stage electrical failure sequence ---------- */

const SPARK_COUNT = 12;
const SMOKE_PUFFS = 14;

// shared scratch vectors (avoid per-frame allocation)
const _sparkV = new THREE.Vector3();
const _sparkUp = new THREE.Vector3(0, 1, 0);

/**
 * Stage 4 · Web Audio electrical pop + sizzle, played once per burnout.
 * Wrapped in try/catch: autoplay policies and missing AudioContext are silent.
 */
function playBurnoutSound() {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;

    // low "pop" thump: fast pitch-dropping sine
    const pop = ctx.createOscillator();
    pop.type = "sine";
    pop.frequency.setValueAtTime(220, now);
    pop.frequency.exponentialRampToValueAtTime(38, now + 0.12);
    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(0.5, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    pop.connect(popGain).connect(ctx.destination);
    pop.start(now);
    pop.stop(now + 0.18);

    // "sizzle": decaying band-passed noise burst
    const dur = 0.7;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3800;
    bp.Q.value = 0.8;
    const sizzleGain = ctx.createGain();
    sizzleGain.gain.setValueAtTime(0.28, now + 0.02);
    sizzleGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(bp).connect(sizzleGain).connect(ctx.destination);
    noise.start(now + 0.02);

    window.setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // autoplay blocked or Web Audio unavailable — stay silent
  }
}

/**
 * Drives the whole failure sequence from one useFrame timeline (no state):
 *   0–0.3s   arc flash + 12 ballistic spark streaks with gravity
 *   0–1.6s   part chars to carbon with a fading ember (handled in AnimatedPart)
 *   0.15–3s  helical wispy smoke plume
 *   forever  soft radial scorch decal on the PCB, until repair
 */
function FaultOverlay({
  part,
  coords,
  explode,
}: {
  part: Part;
  /** Explicit [x, z] origin from the bench (defaults to the part's own coords). */
  coords?: [number, number];
  explode: number;
}) {
  const root = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const emberLight = useRef<THREE.PointLight>(null);
  const sparks = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Group>(null);
  const age = useRef(0);
  const layer = part.smd ? 1 : part.kind === "hdr" ? 3 : 2;
  const origin = coords ?? part.p;

  // spark ballistics: initial velocities, biased upward and outward
  const sparkState = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, () => {
        const a = Math.random() * Math.PI * 2;
        return {
          x: (Math.random() - 0.5) * 0.1,
          y: 0.15,
          z: (Math.random() - 0.5) * 0.1,
          vx: Math.cos(a) * (0.8 + Math.random() * 2.2),
          vy: 2.5 + Math.random() * 3.5,
          vz: Math.sin(a) * (0.8 + Math.random() * 2.2),
        };
      }),
    [],
  );

  // soft radial scorch decal texture (drawn once on a tiny canvas)
  const scorchTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx2 = c.getContext("2d");
    if (ctx2) {
      const g = ctx2.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, "rgba(8,6,4,0.92)");
      g.addColorStop(0.55, "rgba(12,9,7,0.55)");
      g.addColorStop(1, "rgba(12,9,7,0)");
      ctx2.fillStyle = g;
      ctx2.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => scorchTex.dispose(), [scorchTex]);

  useFrame((_, dt) => {
    age.current += dt;
    const a = age.current;

    // ease the whole overlay down onto the part (and follow the exploded view)
    const g = root.current;
    if (g) {
      const ty = PCB_T / 2 + explode * layer * 1.1;
      const k = 1 - Math.exp(-dt * 7);
      g.position.y += (ty - g.position.y) * k;
      g.scale.setScalar(g.scale.x + (1 - g.scale.x) * k);
    }

    /* Stage 1 · arc flash — bright orange-white, decays within 0.3s */
    if (flash.current) {
      const f = Math.max(0, 1 - a / 0.3);
      flash.current.intensity = 60 * f * f;
      flash.current.visible = f > 0.01;
    }

    /* Stage 1 · ballistic sparks: gravity, streak orientation, fade */
    if (sparks.current) {
      const alive = a < 1.1;
      sparks.current.visible = alive;
      if (alive) {
        sparks.current.children.forEach((c, i) => {
          const s = sparkState[i];
          s.vy -= 12 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.z += s.vz * dt;
          if (s.y < 0.03 && s.vy < 0) {
            // settle on the board surface
            s.y = 0.03;
            s.vy = 0;
            s.vx *= 0.86;
            s.vz *= 0.86;
          }
          c.position.set(s.x, s.y, s.z);
          _sparkV.set(s.vx, s.vy, s.vz);
          if (_sparkV.lengthSq() > 1e-6)
            (c as THREE.Mesh).quaternion.setFromUnitVectors(
              _sparkUp,
              _sparkV.normalize(),
            );
          const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
          m.opacity = 0.95 * Math.max(0, 1 - a / 1.0);
        });
      }
    }

    /* Stage 2 · ember light while the charred husk cools */
    if (emberLight.current) {
      const e = Math.max(0, 1.6 * Math.exp(-a * 1.6));
      emberLight.current.intensity = e;
      emberLight.current.visible = e > 0.02;
    }

    /* Stage 3 · helical smoke plume, ~3 seconds after failure */
    if (smoke.current) {
      const sa = a - 0.15;
      const alive = sa > 0 && sa < 3.2;
      smoke.current.visible = alive;
      if (alive) {
        const globalFade = Math.min(1, Math.max(0, (3.2 - sa) / 0.8));
        smoke.current.children.forEach((c, i) => {
          const p = (sa * 0.5 + i / SMOKE_PUFFS) % 1;
          const r = 0.06 + p * 0.3;
          const ang = p * Math.PI * 4 + i * 1.9;
          c.position.set(Math.sin(ang) * r, p * 2.4, Math.cos(ang) * r);
          c.scale.setScalar(0.5 + p * 1.4);
          const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
          m.opacity = 0.28 * (1 - p) * globalFade;
        });
      }
    }
  });

  return (
    <group ref={root} position={[origin[0], 7, origin[1]]} scale={0.001}>
      {/* Stage 1 · arc flash */}
      <pointLight
        ref={flash}
        position={[0, 0.35, 0]}
        color="#fff3d6"
        intensity={60}
        distance={6}
        decay={2}
        visible={false}
      />
      {/* Stage 1 · 12 glowing spark streaks */}
      <group ref={sparks}>
        {Array.from({ length: SPARK_COUNT }).map((_, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.018, 0.14, 0.018]} />
            <meshStandardMaterial
              color="#ffbe3b"
              emissive="#ffbe3b"
              emissiveIntensity={3}
              transparent
              opacity={0.95}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      {/* Stage 2 · ember glow light while the husk cools */}
      <pointLight
        ref={emberLight}
        position={[0, 0.3, 0]}
        color="#ff3b00"
        intensity={1.6}
        distance={2.4}
        visible={false}
      />
      {/* Stage 2 · soft radial scorch mark on the PCB (stays until repair) */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.75, 32]} />
        <meshBasicMaterial map={scorchTex} transparent depthWrite={false} />
      </mesh>
      {/* Stage 3 · 14 wispy helical smoke puffs */}
      <group ref={smoke} visible={false}>
        {Array.from({ length: SMOKE_PUFFS }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial
              color="#6e6e6e"
              transparent
              opacity={0.28}
              depthWrite={false}
              roughness={1}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------- Missing / halted part locator (halt + degraded faults) ---------- */

/**
 * Animated pulsing red/amber locator rings hovering at y = 0.03 directly over
 * the solder pads of a removed (open-circuit) or mis-behaving part, so the
 * learner sees at a glance where the fault occurred on the board. Two rings
 * breathe in anti-phase — scale and emissiveIntensity driven purely in
 * useFrame, no state.
 */
function FaultLocator({
  coords,
  explode,
  tone = "red",
}: {
  coords: [number, number];
  explode: number;
  /** Ring colour family: "red" for halt (open circuit), "amber" for degraded. */
  tone?: "red" | "amber";
}) {
  const inner = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  const innerColor = tone === "amber" ? "#ffb020" : "#ff2b2b";
  const outerColor = tone === "amber" ? "#ffd34d" : "#ffb020";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4.5);
    if (inner.current) {
      inner.current.scale.setScalar(0.85 + pulse * 0.45);
      const m = inner.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.2 + pulse * 2.4;
      m.opacity = 0.55 + pulse * 0.4;
    }
    if (outer.current) {
      outer.current.scale.setScalar(1.35 - pulse * 0.45);
      const m = outer.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.8 + (1 - pulse) * 2.2;
      m.opacity = 0.3 + (1 - pulse) * 0.45;
    }
  });

  return (
    // the board itself drops -explode*0.6 in the exploded view; follow it
    <group position={[coords[0], PCB_T / 2 - explode * 0.6, coords[1]]}>
      {/* tight red ring hugging the part's pads */}
      <mesh ref={inner} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.26, 0.36, 40]} />
        <meshStandardMaterial
          color={innerColor}
          emissive={innerColor}
          emissiveIntensity={2}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* wider halo breathing outward */}
      <mesh ref={outer} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.44, 0.55, 40]} />
        <meshStandardMaterial
          color={outerColor}
          emissive={outerColor}
          emissiveIntensity={1.5}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ---------- Live UART activity LEDs (Fig. 04 CP2102N bridge) ---------- */

/**
 * TX/RX indicator dots beside the USB-UART bridge. They pulse in anti-phase
 * at the serial log cadence while the devkit sketch is running.
 */
function UartLeds({ active }: { active: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const phase = t * 2.2 + i * Math.PI;
      m.emissiveIntensity = active ? 1.6 + Math.sin(phase) * 1.4 : 0.1;
    });
  });
  return (
    <group position={[0, PCB_T / 2 + 0.02, 0]}>
      {[
        { x: -1.32, z: 0.3, c: "#ffb300" },
        { x: -1.78, z: -0.3, c: "#7fd4ff" },
      ].map((p, i) => (
        <mesh key={i} position={[p.x, 0.1, p.z]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial
            color="#fff2cf"
            emissive={p.c}
            emissiveIntensity={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- HC-SR04 reflector target (lab instrument slider) ---------- */

/**
 * Small retro-reflective target block standing in front of the sonar board's
 * transducer cans along the acoustic axis (+X). The 2D slider distance
 * (5–200 cm) is compressed into bench units so the full range stays in frame;
 * the block glides toward/away with an exponential ease. Purely procedural.
 */
function ReflectorTarget({ distance, parts }: { distance: number; parts: Part[] }) {
  const g = useRef<THREE.Group>(null);
  // anchor on the T/R cans: front-most transducer x, centred between them on z
  const cans = parts.filter((p) => p.kind === "transducer");
  const x0 = cans.length ? Math.max(...cans.map((c) => c.p[0])) : 1.7;
  const z0 = cans.length
    ? cans.reduce((s, c) => s + c.p[1], 0) / cans.length
    : 0;
  // 5 cm → 1.0 u from the cans … 200 cm → 9.5 u (compressed bench scale)
  const target = x0 + 1 + ((distance - 5) / 195) * 8.5;

  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.position.x = THREE.MathUtils.lerp(
      g.current.position.x,
      target,
      1 - Math.exp(-dt * 6),
    );
  });

  return (
    <group ref={g} position={[target, 0, z0]}>
      {/* base plate resting flush with the board's underside plane */}
      <mesh castShadow receiveShadow position={[0, -PCB_T / 2 + 0.03, 0]}>
        <boxGeometry args={[0.9, 0.06, 1.7]} />
        <meshStandardMaterial color="#4a453c" roughness={0.7} />
      </mesh>
      {/* target block body */}
      <mesh castShadow position={[0, -PCB_T / 2 + 0.6, 0]}>
        <boxGeometry args={[0.5, 1.1, 1.3]} />
        <meshStandardMaterial color="#b9b3a6" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* retro-reflective patch facing back toward the transducers (-X) */}
      <mesh position={[-0.26, -PCB_T / 2 + 0.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial color="#f2ede1" roughness={0.2} metalness={0.5} />
      </mesh>
    </group>
  );
}

/* ---------- IMU tilt rig (Fig. 09 MPU-6050 bench controls) ---------- */

/**
 * Tilts the whole board assembly toward the instrument panel's rig angles
 * (degrees → radians) with an exponential ease — the MPU-6050's serial
 * stream reports exactly this attitude, so the board leans as the slider
 * moves and levels again when the sketch stops. Purely procedural.
 */
function TiltRig({
  pitch,
  roll,
  active,
  children,
}: {
  pitch: number;
  roll: number;
  active: boolean;
  children: ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    // +pitch = nose up about the bench Z axis · +roll = right edge down
    // about the bench X axis — matches the telemetry's accel model
    // (ax = sin(pitch), ay = −sin(roll), az = cos(pitch)·cos(roll)).
    const k = 1 - Math.exp(-dt * 5);
    const tx = active ? THREE.MathUtils.degToRad(roll) : 0;
    const tz = active ? THREE.MathUtils.degToRad(pitch) : 0;
    grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, tx, k);
    grp.rotation.z = THREE.MathUtils.lerp(grp.rotation.z, tz, k);
  });
  return <group ref={g}>{children}</group>;
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
  /** True while the board's sketch is running (drives live animations). */
  running: boolean;
  /** Configured part values (e.g. resistor value → LED brightness). */
  values: Record<string, string>;
  /** Structured fault driving the HUD banner + burn visuals. */
  eduFault: EduFault | null;
  /** Id of the part that caused/owns the active fault (burned victim for burnout). */
  damagedPartId?: string;
  /** [x, z] bench coordinates of that part — anchors the 3D fault visuals. */
  faultPartId?: [number, number];
  /** Bench view: interactive procedural parts vs real CAD (.glb). */
  viewMode: "parts" | "cad";
  /** Click-to-remove a placed part directly on the 3D board. */
  onRemovePart: (id: string) => void;
  /** "Repair & Replace Part" quick-fix on the HUD banner. */
  onRepair: () => void;
  hover: string | null;
  onHover: (label: string | null) => void;
  onGlbFallback: () => void;
  /** Sonar target distance in cm (5–200) from the lab instrument panel. */
  targetDistance?: number;
  /** 3D jumper-wire / current-flow overlay visible (ControlColumn toggle). */
  showWires?: boolean;
  /** Blink phase of the running sketch (gates pulsed wire loops). */
  blink?: boolean;
  /** Fig. 03: D9 held HIGH with the control/load loop complete (relay closed). */
  d9Energized?: boolean;
  /** Fig. 09 · IMU tilt-rig attitude in degrees (drives the board tilt). */
  imuTilt?: { pitch: number; roll: number };
  /** Fig. 10 · KY-040 live detent count + axial SW press. */
  encoderStep?: number;
  encoderPressed?: boolean;
  /** Fig. 11 · PCA9685 servo angle (0–180°) driving the channel LEDs. */
  pcaAngle?: number;
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
  running,
  values,
  eduFault,
  damagedPartId,
  faultPartId,
  viewMode,
  onRemovePart,
  onRepair,
  hover,
  onHover,
  onGlbFallback,
  targetDistance,
  showWires = true,
  blink = false,
  d9Energized = false,
  imuTilt,
  encoderStep = 0,
  encoderPressed = false,
  pcaAngle = 90,
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
  // Fault anchor: the explicit [x, z] coords from the bench win, then the
  // damaged part's own coordinates.
  const faultPart = damagedPartId
    ? parts.find((p) => p.id === damagedPartId)
    : undefined;
  const faultCoord = faultPartId ?? faultPart?.p;
  const hasUsbPort = parts.some((p) => p.kind === "usb");

  // Stage 4 · electrical pop + sizzle, once per burnout fault. The useEffect
  // dep on the whole fault object (keyed remounts) guarantees a single play.
  useEffect(() => {
    if (eduFault?.severity === "burnout") playBurnoutSound();
  }, [eduFault]);

  // Publish the lab instrument state onto the board-module bench buses
  // (module-level mutable state, same cross-component pattern as the
  // KY-040's ky040Debounce): Fig. 10 reads the shaft step/SW in useFrame,
  // Fig. 11 reads the servo angle for its 16 PWM activity LEDs. Safe to
  // write on any board — only the matching board's meshes ever read them.
  useEffect(() => {
    ky040Shaft.step = encoderStep;
    ky040Shaft.pressed = encoderPressed;
  }, [encoderStep, encoderPressed]);
  useEffect(() => {
    pca9685Pwm.angle = pcaAngle;
    pca9685Pwm.running = running;
  }, [pcaAngle, running]);

  // Fig. 09 · GY-521 board? (each lab's boardStyle is unique)
  const isImuBench = spec.boardStyle === "breakout-blue";

  // Solder joints follow only the parts that are actually on the board.
  const placedParts = parts.filter((p) => placed.has(p.id));

  // Live circuit: fully assembled, soldered, powered and un-broken. Every
  // current-flow animation keys off this, so any removed part (=> fault or
  // desoldered joint) halts the pulses immediately. A degraded warning (e.g.
  // 10kΩ starved LED) keeps the circuit alive.
  const style = boardStyleOf(spec.name);
  const flow =
    usb &&
    soldered &&
    count === total &&
    (!eduFault || eduFault.severity === "degraded");

  // A 10kΩ starves the LED branch — the dome glows dimly instead of bright.
  const dimLed = (values["r1"] ?? "").includes("10kΩ");

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
          {style && flow && <CurrentFlow style={style} />}
          {style === "devkit-narrow" && <UartLeds active={flow && running} />}
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
                energy={p.kind === "led" && !p.smd && dimLed ? 0.22 : 1}
                charred={burnPart?.id === p.id && eduFault?.severity === "burnout"}
                damagedPartId={damagedPartId}
                faultPartId={faultPartId}
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
        {/* Fig. 09 · the whole board leans with the IMU tilt rig while running */}
        <TiltRig
          pitch={imuTilt?.pitch ?? 0}
          roll={imuTilt?.roll ?? 0}
          active={isImuBench && running}
        >
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
          {/* 3D jumper wires + directional current flow (procedural bench view) */}
          {viewMode === "parts" && showWires && (
            <CircuitWireOverlay
              spec={spec}
              placed={placed}
              powered={flow}
              running={running}
              blink={blink}
              d9Energized={d9Energized}
            />
          )}
          {/* Burn-out effects render for both the procedural scene and a loaded .glb */}
          {burnPart && (
            <FaultOverlay
              key={`${spec.id}-${burnPart.id}-fault`}
              part={burnPart}
              coords={faultCoord}
              explode={explode}
            />
          )}
          {/* Missing / halted part locator: pulsing rings over the open pads
              (halt + degraded faults — burnout uses the FaultOverlay above) */}
          {eduFault && eduFault.severity !== "burnout" && faultCoord && (
            <FaultLocator
              key={`${spec.id}-${eduFault.partId}-locator`}
              coords={faultCoord}
              explode={explode}
              tone={eduFault.severity === "degraded" ? "amber" : "red"}
            />
          )}
        </TiltRig>
        {/* Sonar bench: reflector target block on the acoustic axis (+X) */}
        {spec.boardStyle === "hc-sr04" && targetDistance != null && (
          <ReflectorTarget distance={targetDistance} parts={parts} />
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
