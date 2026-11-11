// ─────────────────────────────────────────────────────────────────────────────
// Works out WHERE current flows right now. Pure TypeScript, easy to test.
// Each board lists its routes in `currentPaths` (ordered part ids, source first).
// Current can only travel along a route up to the first part that is missing,
// unsoldered or burned. That part is the "break".
// ─────────────────────────────────────────────────────────────────────────────
import type {BoardDefinition, BoardState} from '../data/types';

export interface FlowSegment {fromPartId: string; toPartId: string; isLive: boolean}
/** off = nothing flows · normal = healthy current · surge = far too much current (a part is burning) */
export type FlowMode = 'off' | 'normal' | 'surge';
export interface CurrentFlow {mode: FlowMode; segments: FlowSegment[]; breakPartIds: string[]}

export function getCurrentFlow(board: BoardDefinition, state: BoardState): CurrentFlow {
  const result = state.lastResult;
  const isPowered = state.isPowered && result !== null;
  const isSurge = isPowered && result!.burnedPartIds.length > 0;  // a part just burned: too much current
  const isDead = isPowered && result!.status === 'DEAD';          // no power source: nothing can flow anywhere
  const isRunning = isPowered && result!.status === 'RUNNING';

  const isPlaced = (id: string) => state.placedPartIds.includes(id);
  const isWorking = (id: string) => isPlaced(id) && state.solderedPartIds.includes(id) && !state.burnedPartIds.includes(id);

  const segments: FlowSegment[] = [];
  const breakPartIds: string[] = [];

  board.currentPaths.forEach((path, pathIndex) => {
    const breakIndex = path.findIndex((id) => !isWorking(id)); // first part that cannot carry current (-1 = none)
    const hasBreak = breakIndex !== -1;

    path.slice(1).forEach((toPartId, i) => {
      const fromPartId = path[i];
      let isLive = false;
      if (isPowered && !isDead) {
        if (isSurge) isLive = isPlaced(fromPartId) && isPlaced(toPartId); // everything placed gets hammered
        else if (hasBreak) isLive = i + 1 < breakIndex;                    // current reaches only up to the break
        else isLive = isRunning;                                            // complete route: flows only if the board really runs
      }
      segments.push({fromPartId, toPartId, isLive});
    });

    // Mark the break (a dead board only marks its first route, the one holding the power source).
    if (isPowered && !isSurge && hasBreak && (!isDead || pathIndex === 0)) breakPartIds.push(path[breakIndex]);
  });

  const mode: FlowMode = isSurge ? 'surge' : segments.some((segment) => segment.isLive) ? 'normal' : 'off';
  return {mode, segments, breakPartIds};
}
