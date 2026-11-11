// ─────────────────────────────────────────────────────────────────────────────
// Draws the printed copper traces and the animated current on top of them.
//   layer="traces"  → copper + glowing dots moving from source to load (drawn UNDER the parts)
//   layer="markers" → a pulsing red ✕ where the current stops (drawn OVER the parts)
// What the user sees:  amber dots = healthy current (faster = more current)
//                      red fast dots = surge · ✕ = broken route
// ─────────────────────────────────────────────────────────────────────────────
import {motion} from 'framer-motion';
import type {BoardDefinition} from '../data/types';
import type {CurrentFlow} from '../engine/currentFlow';
import {projectToScreen} from '../render/isometric';

const COPPER = '#9a6b1f', COPPER_SHINE = '#d9a441';
const FLOW_COLORS = {normal: '#ffe066', surge: '#ff4d3d'};
const DOT_SPACING = 18; // distance between current dots along the trace

interface CurrentFlowLayerProps {layer: 'traces' | 'markers'; board: BoardDefinition; flow: CurrentFlow; currentMilliamps: number}

export function CurrentFlowLayer({layer, board, flow, currentMilliamps}: CurrentFlowLayerProps) {
  const partById = Object.fromEntries(board.parts.map((part) => [part.id, part]));
  const centerOf = (partId: string) => ({x: partById[partId].x + partById[partId].width / 2, y: partById[partId].y + partById[partId].depth / 2});

  if (layer === 'markers') {
    return (<>
      {flow.breakPartIds.map((partId) => {
        const center = centerOf(partId), spot = projectToScreen(center.x, center.y, partById[partId].height + 16);
        return (
          <motion.g key={partId} animate={{scale: [1, 1.25, 1]}} transition={{duration: 1, repeat: Infinity}} style={{transformBox: 'fill-box', transformOrigin: 'center'}}>
            <circle cx={spot.x} cy={spot.y} r={12} fill="var(--bad)" stroke="#fff" strokeWidth={2} />
            <text x={spot.x} y={spot.y + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fff">✕</text>
          </motion.g>
        );
      })}
    </>);
  }

  const flowColor = FLOW_COLORS[flow.mode === 'surge' ? 'surge' : 'normal'];
  // More current = faster dots. 14 mA is a slow stroll, 600 mA is a rush (clamped so it never gets silly).
  const secondsPerDotStep = Math.max(0.12, 0.9 - currentMilliamps / 700);

  return (<>
    {flow.segments.map(({fromPartId, toPartId, isLive}, index) => {
      const from = centerOf(fromPartId), to = centerOf(toPartId);
      // Route like a real PCB trace: go sideways first, then turn 90° to reach the next part.
      const start = projectToScreen(from.x, from.y), corner = projectToScreen(to.x, from.y), end = projectToScreen(to.x, to.y);
      const path = `M ${start.x} ${start.y} L ${corner.x} ${corner.y} L ${end.x} ${end.y}`;
      return (
        <g key={index} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={path} stroke={COPPER} strokeWidth={7} />
          <path d={path} stroke={COPPER_SHINE} strokeWidth={3.5} />
          {isLive && (<>
            <path d={path} stroke={flowColor} strokeWidth={12} opacity={0.25} className="blur-sm" />
            {/* Round-capped zero-length dashes look like dots; sliding the dash offset makes them travel from source to load. */}
            <motion.path d={path} stroke={flowColor} strokeWidth={5} strokeDasharray={`0.1 ${DOT_SPACING}`} initial={false}
              animate={{strokeDashoffset: [0, -DOT_SPACING]}} transition={{duration: secondsPerDotStep, repeat: Infinity, ease: 'linear'}} />
          </>)}
        </g>
      );
    })}
  </>);
}
