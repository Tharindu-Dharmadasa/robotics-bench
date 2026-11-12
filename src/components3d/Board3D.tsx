// ─────────────────────────────────────────────────────────────────────────────
// The 3D board: plinth, PCB, perfboard pads, mounting holes, copper traces with
// moving current dots, empty-slot footprints, solder joints, and every part.
// Same data and same state as the 2D view: only the drawing differs.
// ─────────────────────────────────────────────────────────────────────────────
import {useLayoutEffect, useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Billboard, Line, RoundedBox} from '@react-three/drei';
import {DoubleSide, Object3D, Vector3} from 'three';
import type {Group, InstancedMesh} from 'three';
import type {PartDefinition} from '../data/types';
import {getCurrentFlow} from '../engine/currentFlow';
import {useBenchStore, useCurrentBoard} from '../store/benchStore';
import {BOARD_DEPTH, BOARD_WIDTH, PCB_THICKNESS, UNIT, toScene} from '../render3d/scene';
import {Part3D} from './Part3D';
import {getEffectivePart} from '../data/parameters';
import {GOLD} from './PartModel';

const COPPER = '#d9a441';
const FLOW_COLORS = {normal: '#ffe066', surge: '#ff4d3d'};

/** A grid of gold-ringed holes, like a hobby perfboard. One instanced mesh = 209 holes for the price of one. */
function PerfboardHoles() {
  const holes = useRef<InstancedMesh>(null);
  const columns = 19, rows = 11, spacing = 12.5; // board units
  useLayoutEffect(() => {
    const mesh = holes.current;
    if (!mesh) return;
    const placeholder = new Object3D();
    let index = 0;
    for (let column = 0; column < columns; column++) for (let row = 0; row < rows; row++) {
      const [x, y, z] = toScene(10 + column * spacing, 10 + row * spacing, 0.2);
      placeholder.position.set(x, y, z);
      placeholder.rotation.x = -Math.PI / 2; // lie flat on the board
      placeholder.updateMatrix();
      mesh.setMatrixAt(index++, placeholder.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={holes} args={[undefined, undefined, columns * rows]}>
      <ringGeometry args={[0.06, 0.14, 16]} /><meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.35} side={DoubleSide} />
    </instancedMesh>
  );
}

function MountingHoles() {
  return (<>{[[8, 8], [BOARD_WIDTH - 8, 8], [8, BOARD_DEPTH - 8], [BOARD_WIDTH - 8, BOARD_DEPTH - 8]].map(([x, y]) => (
    <group key={`${x}-${y}`} position={toScene(x, y, 0.25)} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh><circleGeometry args={[0.14, 20]} /><meshBasicMaterial color="#101010" /></mesh>
      <mesh><ringGeometry args={[0.14, 0.26, 20]} /><meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} /></mesh>
    </group>
  ))}</>);
}

/** Glowing dots that travel along a polyline from its start to its end. More current = faster. */
function FlowDots({points, color, speed}: {points: [number, number, number][]; color: string; speed: number}) {
  const dots = useRef<InstancedMesh>(null);
  const {vectors, cumulative, total} = useMemo(() => {
    const list = points.map((p) => new Vector3(...p));
    const lengths = [0];
    for (let i = 1; i < list.length; i++) lengths.push(lengths[i - 1] + list[i].distanceTo(list[i - 1]));
    return {vectors: list, cumulative: lengths, total: lengths[lengths.length - 1]};
  }, [points]);
  const count = Math.max(2, Math.round(total / 0.5)); // one dot every ~0.5 units
  const placeholder = useMemo(() => new Object3D(), []);
  useFrame(({clock}) => {
    const mesh = dots.current;
    if (!mesh || total === 0) return;
    const phase = (clock.elapsedTime * speed / total) % 1; // how far every dot has advanced along the trace
    for (let i = 0; i < count; i++) {
      const distance = ((i / count + phase) % 1) * total;
      let leg = 1;
      while (leg < cumulative.length - 1 && cumulative[leg] < distance) leg++;
      const along = (distance - cumulative[leg - 1]) / (cumulative[leg] - cumulative[leg - 1] || 1);
      placeholder.position.lerpVectors(vectors[leg - 1], vectors[leg], along);
      placeholder.updateMatrix();
      mesh.setMatrixAt(i, placeholder.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh key={count} ref={dots} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.07, 12, 12]} /><meshBasicMaterial color={color} />
    </instancedMesh>
  );
}

/** Pulsing red ✕ that always faces the camera, where current stops. */
function BreakMarker({position}: {position: [number, number, number]}) {
  const pulse = useRef<Group>(null);
  useFrame(({clock}) => pulse.current?.scale.setScalar(1 + 0.2 * Math.sin(clock.elapsedTime * 6)));
  return (
    <Billboard position={position}>
      <group ref={pulse}>
        <mesh><circleGeometry args={[0.3, 24]} /><meshBasicMaterial color="#d93025" /></mesh>
        {[1, -1].map((side) => <mesh key={side} position={[0, 0, 0.01]} rotation={[0, 0, side * Math.PI / 4]}><boxGeometry args={[0.38, 0.07, 0.01]} /><meshBasicMaterial color="#ffffff" /></mesh>)}
      </group>
    </Billboard>
  );
}

/** A solder pad (gold ring) with a blob of solder on it once the part is placed. Grey = not soldered yet, bright = soldered. */
function SolderJoint({position, isVisible, isSoldered}: {position: [number, number, number]; isVisible: boolean; isSoldered: boolean}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position-y={0.006}><ringGeometry args={[0.07, 0.16, 20]} /><meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} /></mesh>
      {isVisible && (
        <mesh position-y={0.04} scale={[1, 0.6, 1]}><sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color={isSoldered ? '#e6e0d0' : '#6b6b6b'} emissive={isSoldered ? '#e6a817' : '#000000'} emissiveIntensity={isSoldered ? 0.8 : 0} metalness={0.7} roughness={0.25} />
        </mesh>
      )}
    </group>
  );
}

export function Board3D() {
  const {board, boardState} = useCurrentBoard();
  const {togglePart, hoveredPartId, setHoveredPart} = useBenchStore();
  const result = boardState.lastResult;
  const flow = getCurrentFlow(board, boardState);
  const currentMilliamps = result?.currentMilliamps ?? 0;
  const dotSpeed = Math.min(6, 1.2 + currentMilliamps / 120); // scene units per second
  const partById: Record<string, PartDefinition> = Object.fromEntries(board.parts.map((part) => [part.id, part]));

  /** A PCB-style route between two parts: go sideways first, then turn 90° (same as the 2D view). */
  const routeBetween = (from: PartDefinition, to: PartDefinition): [number, number, number][] => {
    const fromX = from.x + from.width / 2, fromY = from.y + from.depth / 2, toX = to.x + to.width / 2, toY = to.y + to.depth / 2;
    return [toScene(fromX, fromY, 0.5), toScene(toX, fromY, 0.5), toScene(toX, toY, 0.5)];
  };
  const flowColor = FLOW_COLORS[flow.mode === 'surge' ? 'surge' : 'normal'];

  return (
    <group key={board.id}>
      {/* Plinth under the board, like the display base in the reference video. */}
      <mesh position={[0, -PCB_THICKNESS / 2 - 0.07, 0]} receiveShadow><boxGeometry args={[BOARD_WIDTH * UNIT + 0.9, 0.14, BOARD_DEPTH * UNIT + 0.9]} /><meshStandardMaterial color="#d8d2c2" roughness={0.9} /></mesh>
      <RoundedBox args={[BOARD_WIDTH * UNIT, PCB_THICKNESS, BOARD_DEPTH * UNIT]} radius={0.12} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={board.pcbColor} roughness={0.55} />
      </RoundedBox>
      {board.pcbStyle === 'perfboard' && <PerfboardHoles />}
      <MountingHoles />

      {/* Copper traces for every route; live ones get glowing dots travelling along them. */}
      {flow.segments.map(({fromPartId, toPartId, isLive}, index) => {
        const points = routeBetween(partById[fromPartId], partById[toPartId]);
        return (<group key={index}>
          <Line points={points} color={COPPER} lineWidth={4} />
          {isLive && <Line points={points} color={flowColor} lineWidth={9} transparent opacity={0.25} />}
          {isLive && <FlowDots points={points} color={flowColor} speed={dotSpeed} />}
        </group>);
      })}

      {board.parts.map((rawPart) => {
        const part = getEffectivePart(rawPart, boardState.partValues); // resistor bands, LED colour and names follow the chosen values
        const isPlaced = boardState.placedPartIds.includes(part.id);
        const isSoldered = boardState.solderedPartIds.includes(part.id);
        const isBlinking = Boolean(result?.blinkingPartIds.includes(part.id));
        return (<group key={part.id}>
          {/* Footprint of an empty slot: orange for normal parts, red for "mistake" parts. */}
          {!isPlaced && (
            <mesh position={toScene(part.x + part.width / 2, part.y + part.depth / 2, 0.3)} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[part.width * UNIT, part.depth * UNIT]} /><meshBasicMaterial color={part.isMistake ? '#d93025' : '#e8662a'} transparent opacity={0.35} />
            </mesh>
          )}
          {[0.25, 0.75].map((fraction) => <SolderJoint key={fraction} position={toScene(part.x + part.width * fraction, part.y + part.depth + 2, 0)} isVisible={isPlaced} isSoldered={isSoldered} />)}
          <Part3D part={part} isPlaced={isPlaced} isBurned={boardState.burnedPartIds.includes(part.id)}
            isLit={isBlinking || Boolean(result?.litPartIds.includes(part.id))} isBlinking={isBlinking} isHovered={hoveredPartId === part.id} brightness={result?.brightness?.[part.id] ?? 1}
            onClick={() => togglePart(part.id)} onHoverChange={(isHovering) => setHoveredPart(isHovering ? part.id : null)} />
        </group>);
      })}

      {flow.breakPartIds.map((partId) => <BreakMarker key={partId} position={toScene(partById[partId].x + partById[partId].width / 2, partById[partId].y + partById[partId].depth / 2, partById[partId].height + 16)} />)}
    </group>
  );
}
