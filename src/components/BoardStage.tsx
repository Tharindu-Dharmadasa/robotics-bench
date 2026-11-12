// The drawing area: the circuit board (a flat slab) plus one PartSprite per part.
import { useBenchStore, useCurrentBoard } from "../store/benchStore";
import {
  OUTLINE_STYLE,
  projectToScreen,
  toPolygonPoints,
} from "../render/isometric";
import { PartSprite } from "./PartSprite";
import { CurrentFlowLayer } from "./CurrentFlowLayer";
import { getCurrentFlow } from "../engine/currentFlow";

const BOARD_WIDTH = 240,
  BOARD_DEPTH = 150,
  BOARD_THICKNESS = 12;

export function BoardStage() {
  const { board, boardState } = useCurrentBoard();
  const { togglePart, hoveredPartId, setHoveredPart } = useBenchStore();
  const result = boardState.lastResult; // what the engine said after the latest action (null if unpowered)
  const flow = getCurrentFlow(board, boardState); // which copper segments carry current right now
  const currentMilliamps = result?.currentMilliamps ?? 0;

  // Draw back-to-front: parts farther from the viewer (smaller x + y) are drawn first,
  // so nearer parts correctly cover them. This is the "painter's algorithm".
  const partsBackToFront = [...board.parts].sort(
    (a, b) => a.x + a.y - (b.x + b.y),
  );

  return (
    <svg
      viewBox="0 0 720 400"
      className="block w-full rounded-xl border border-[var(--line)] bg-[var(--surface)]"
      role="img"
      aria-label={`${board.name} board`}
    >
      {/* The PCB slab: left side, right side, then the top surface. */}
      <g fill={board.pcbColor} {...OUTLINE_STYLE}>
        <polygon
          style={{ filter: "brightness(.82)" }}
          points={toPolygonPoints([
            [0, BOARD_DEPTH, -BOARD_THICKNESS],
            [BOARD_WIDTH, BOARD_DEPTH, -BOARD_THICKNESS],
            [BOARD_WIDTH, BOARD_DEPTH, 0],
            [0, BOARD_DEPTH, 0],
          ])}
        />
        <polygon
          style={{ filter: "brightness(.64)" }}
          points={toPolygonPoints([
            [BOARD_WIDTH, 0, -BOARD_THICKNESS],
            [BOARD_WIDTH, BOARD_DEPTH, -BOARD_THICKNESS],
            [BOARD_WIDTH, BOARD_DEPTH, 0],
            [BOARD_WIDTH, 0, 0],
          ])}
        />
        <polygon
          points={toPolygonPoints([
            [0, 0, 0],
            [BOARD_WIDTH, 0, 0],
            [BOARD_WIDTH, BOARD_DEPTH, 0],
            [0, BOARD_DEPTH, 0],
          ])}
        />
      </g>

      {/* Mounting holes in the four corners. */}
      {[
        [8, 8],
        [BOARD_WIDTH - 8, 8],
        [8, BOARD_DEPTH - 8],
        [BOARD_WIDTH - 8, BOARD_DEPTH - 8],
      ].map(([holeX, holeY]) => {
        const hole = projectToScreen(holeX, holeY);
        return (
          <ellipse
            key={`${holeX}-${holeY}`}
            cx={hole.x}
            cy={hole.y}
            rx={5}
            ry={3}
            fill="var(--ink)"
            opacity={0.55}
          />
        );
      })}

      {/* Printed copper traces, with animated current on the live ones. Drawn before the parts so parts sit on top. */}
      <CurrentFlowLayer
        layer="traces"
        board={board}
        flow={flow}
        currentMilliamps={currentMilliamps}
      />

      {partsBackToFront.map((part) => {
        const isBlinking = Boolean(result?.blinkingPartIds.includes(part.id));
        return (
          <PartSprite
            key={part.id}
            part={part}
            isPlaced={boardState.placedPartIds.includes(part.id)}
            isSoldered={boardState.solderedPartIds.includes(part.id)}
            isBurned={boardState.burnedPartIds.includes(part.id)}
            isBlinking={isBlinking}
            isGlowing={
              isBlinking || Boolean(result?.litPartIds.includes(part.id))
            }
            isHovered={hoveredPartId === part.id}
            onClick={() => togglePart(part.id)}
            onHoverChange={(isHovering) =>
              setHoveredPart(isHovering ? part.id : null)
            }
          />
        );
      })}
      {/* Red "✕" where the current stops (a part is missing or unsoldered). Drawn last so it is never hidden. */}
      <CurrentFlowLayer
        layer="markers"
        board={board}
        flow={flow}
        currentMilliamps={currentMilliamps}
      />
    </svg>
  );
}
