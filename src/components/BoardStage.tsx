// The drawing area: the circuit board (a flat slab) plus one PartSprite per part.
import {useBenchStore, useCurrentBoard} from '../store/benchStore';
import {motion} from 'framer-motion';
import {OUTLINE_STYLE, projectToScreen, toPolygonPoints} from '../render/isometric';
import {PartSprite} from './PartSprite';

const BOARD_WIDTH = 240, BOARD_DEPTH = 150, BOARD_THICKNESS = 12;

export function BoardStage() {
  const {board, boardState} = useCurrentBoard();
  const {togglePart, hoveredPartId, setHoveredPart} = useBenchStore();
  const result = boardState.lastResult; // what the engine said after the latest action (null if unpowered)
  const isCurrentFlowing = result?.status === 'RUNNING';
  // Copper trace: a line joining the centres of the placed parts (mistake wires excluded).
  const tracePoints = board.parts.filter((part) => boardState.placedPartIds.includes(part.id) && !part.isMistake)
    .map((part) => { const center = projectToScreen(part.x + part.width / 2, part.y + part.depth / 2); return `${center.x},${center.y}`; }).join(' ');

  // Draw back-to-front: parts farther from the viewer (smaller x + y) are drawn first,
  // so nearer parts correctly cover them. This is the "painter's algorithm".
  const partsBackToFront = [...board.parts].sort((a, b) => a.x + a.y - (b.x + b.y));

  return (
    <svg viewBox="0 0 720 400" className="block w-full rounded-xl border border-[var(--line)] bg-[var(--surface)]" role="img" aria-label={`${board.name} board`}>
      {/* The PCB slab: left side, right side, then the top surface. */}
      <g fill={board.pcbColor} {...OUTLINE_STYLE}>
        <polygon style={{filter: 'brightness(.82)'}} points={toPolygonPoints([[0, BOARD_DEPTH, -BOARD_THICKNESS], [BOARD_WIDTH, BOARD_DEPTH, -BOARD_THICKNESS], [BOARD_WIDTH, BOARD_DEPTH, 0], [0, BOARD_DEPTH, 0]])} />
        <polygon style={{filter: 'brightness(.64)'}} points={toPolygonPoints([[BOARD_WIDTH, 0, -BOARD_THICKNESS], [BOARD_WIDTH, BOARD_DEPTH, -BOARD_THICKNESS], [BOARD_WIDTH, BOARD_DEPTH, 0], [BOARD_WIDTH, 0, 0]])} />
        <polygon points={toPolygonPoints([[0, 0, 0], [BOARD_WIDTH, 0, 0], [BOARD_WIDTH, BOARD_DEPTH, 0], [0, BOARD_DEPTH, 0]])} />
      </g>

      {/* Mounting holes in the four corners. */}
      {[[8, 8], [BOARD_WIDTH - 8, 8], [8, BOARD_DEPTH - 8], [BOARD_WIDTH - 8, BOARD_DEPTH - 8]].map(([holeX, holeY]) => {
        const hole = projectToScreen(holeX, holeY);
        return <ellipse key={`${holeX}-${holeY}`} cx={hole.x} cy={hole.y} rx={5} ry={3} fill="var(--ink)" opacity={0.55} />;
      })}

      {/* Copper trace. When the board is running, dashes slide along it to show current flowing. */}
      <motion.polyline points={tracePoints} fill="none" stroke="#d9a441" strokeWidth={2.5} strokeLinejoin="round" initial={false}
        opacity={isCurrentFlowing ? 1 : 0.45} strokeDasharray={isCurrentFlowing ? '6 6' : undefined}
        animate={{strokeDashoffset: isCurrentFlowing ? [0, -12] : 0}}
        transition={isCurrentFlowing ? {duration: 0.6, repeat: Infinity, ease: 'linear'} : {duration: 0}} />

      {partsBackToFront.map((part) => {
        const isBlinking = Boolean(result?.blinkingPartIds.includes(part.id));
        return (
          <PartSprite key={part.id} part={part}
            isPlaced={boardState.placedPartIds.includes(part.id)}
            isSoldered={boardState.solderedPartIds.includes(part.id)}
            isBurned={boardState.burnedPartIds.includes(part.id)}
            isBlinking={isBlinking}
            isGlowing={isBlinking || Boolean(result?.litPartIds.includes(part.id))}
            isHovered={hoveredPartId === part.id}
            onClick={() => togglePart(part.id)}
            onHoverChange={(isHovering) => setHoveredPart(isHovering ? part.id : null)} />
        );
      })}
    </svg>
  );
}
