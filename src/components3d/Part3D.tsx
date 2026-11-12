// ─────────────────────────────────────────────────────────────────────────────
// One part on the 3D board. It receives flags (isPlaced, isBurned...) and
// animates itself: a spring drops it from above onto the board with a small
// bounce; a burned part shakes, turns charred and smokes.
// ─────────────────────────────────────────────────────────────────────────────
import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import type {Group, Mesh, MeshBasicMaterial} from 'three';
import type {PartDefinition} from '../data/types';
import {BrightnessContext, PartModel} from './PartModel';
import {UNIT, toScene} from '../render3d/scene';

const CHARRED = '#2a2a2a';

/** Three dark puffs that rise, grow and fade, forever. */
function Smoke({height}: {height: number}) {
  const puffs = useRef<Mesh[]>([]);
  useFrame(({clock}) => puffs.current.forEach((puff, i) => {
    if (!puff) return;
    const progress = (clock.elapsedTime * 0.6 + i / 3) % 1; // 0 → 1 over the puff's life
    puff.position.y = height + progress * 1.6;
    puff.scale.setScalar(0.5 + progress * 1.6);
    (puff.material as MeshBasicMaterial).opacity = 0.55 * (1 - progress);
  }));
  return (<group>{[0, 1, 2].map((i) => (
    <mesh key={i} ref={(mesh) => { if (mesh) puffs.current[i] = mesh; }} position={[(i - 1) * 0.12, height, 0]}>
      <sphereGeometry args={[0.16, 12, 12]} /><meshBasicMaterial color="#222222" transparent opacity={0.5} />
    </mesh>
  ))}</group>);
}

interface Part3DProps {
  part: PartDefinition; isPlaced: boolean; isBurned: boolean; isLit: boolean; isBlinking: boolean; isHovered: boolean; brightness?: number;
  onClick: () => void; onHoverChange: (isHovering: boolean) => void;
}

export function Part3D({part, isPlaced, isBurned, isLit, isBlinking, isHovered, brightness = 1, onClick, onHoverChange}: Part3DProps) {
  const group = useRef<Group>(null);
  const springPosition = useRef(0), springVelocity = useRef(0); // 0 = floating in the bin, 1 = sitting on the board
  const secondsSinceBurn = useRef(99), wasBurned = useRef(false);
  const [baseX, baseY, baseZ] = toScene(part.x + part.width / 2, part.y + part.depth / 2);

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const delta = Math.min(rawDelta, 0.05);
    // Spring physics: pulled toward 1 (placed) or 0 (bin), with damping. The slight overshoot is the landing bounce.
    springVelocity.current += ((isPlaced ? 1 : 0) - springPosition.current) * 90 * delta - springVelocity.current * 11 * delta;
    springPosition.current += springVelocity.current * delta;
    const progress = springPosition.current;
    g.visible = isPlaced || progress > 0.01;
    g.position.y = baseY + (1 - progress) * 3;     // high above the board when in the bin
    g.rotation.y = (1 - progress) * 1.5;           // spins a little as it falls
    if (isBurned && !wasBurned.current) secondsSinceBurn.current = 0;
    wasBurned.current = isBurned;
    secondsSinceBurn.current += delta;
    g.position.x = baseX + (secondsSinceBurn.current < 0.5 ? Math.sin(secondsSinceBurn.current * 70) * 0.06 : 0); // shake after burning
    g.scale.setScalar(isHovered ? 1.06 : 1);
  });

  // A burned part is drawn charred: dark, no colour bands, no glow.
  const shownPart = isBurned ? {...part, color: CHARRED, glowColor: undefined, bands: part.bands?.map(() => '#333333')} : part;

  return (
    <group ref={group} position={[baseX, baseY, baseZ]}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      onPointerOver={(event) => { event.stopPropagation(); onHoverChange(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { onHoverChange(false); document.body.style.cursor = 'auto'; }}>
      {/* The glow strength follows the real current: a dim LED on a big resistor, a blazing one on a small resistor. */}
      <BrightnessContext.Provider value={brightness}><PartModel part={shownPart} isLit={isLit && !isBurned} isBlinking={isBlinking} /></BrightnessContext.Provider>
      {isBurned && <Smoke height={part.height * UNIT} />}
      {isHovered && (
        <Html position={[0, part.height * UNIT + 0.8, 0]} center style={{pointerEvents: 'none'}}>
          <div className="whitespace-nowrap rounded bg-[var(--ink)] px-2 py-1 text-xs text-[var(--paper)]">{part.name}</div>
        </Html>
      )}
    </group>
  );
}
