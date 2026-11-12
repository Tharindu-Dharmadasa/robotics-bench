// ─────────────────────────────────────────────────────────────────────────────
// Interactive lesson tasks and error hints. Pure functions over the same data
// the rest of the app uses (BoardDefinition + BoardState), so they work for all
// 13 boards without any per-board data.
// ─────────────────────────────────────────────────────────────────────────────
import type {BoardDefinition, BoardState} from '../data/types';
import {getCurrentFlow} from './currentFlow';

export interface LessonTask {id: 'place' | 'solder' | 'power' | 'run' | 'break'; title: string; detail: string; isDone: boolean}

const requiredParts = (board: BoardDefinition) => board.parts.filter((part) => !part.isMistake);

/**
 * The five steps every board teaches, in order. `hasRunBefore` lets "Break it" mean "it worked, THEN you broke it":
 * the caller sets it to true the first time the status becomes RUNNING (a tiny flag in the store).
 */
export function getLessonTasks(board: BoardDefinition, state: BoardState, hasRunBefore = false): LessonTask[] {
  const required = requiredParts(board);
  const placedRequired = required.filter((part) => state.placedPartIds.includes(part.id)).length;
  const allPlaced = placedRequired === required.length;
  const allSoldered = allPlaced && state.placedPartIds.every((id) => state.solderedPartIds.includes(id));
  const status = state.isPowered ? state.lastResult?.status : undefined;
  return [
    {id: 'place', title: 'Place every part', detail: `${placedRequired}/${required.length} placed`, isDone: allPlaced},
    {id: 'solder', title: 'Solder every joint', detail: `${state.solderedPartIds.length}/${state.placedPartIds.length} soldered`, isDone: allSoldered},
    {id: 'power', title: 'Plug in power', detail: 'Press "Plug in USB"', isDone: state.isPowered},
    {id: 'run', title: 'Get it running', detail: 'The status turns RUNNING', isDone: status === 'RUNNING'},
    {id: 'break', title: 'Break it on purpose', detail: board.tryToBreakText,
      isDone: state.burnedPartIds.length > 0 || (hasRunBefore && state.isPowered && status !== undefined && status !== 'RUNNING')},
  ];
}

/** The first task that is not done yet, or null when the lesson is complete. */
export const getNextTask = (tasks: LessonTask[]): LessonTask | null => tasks.find((task) => !task.isDone) ?? null;

/** One sentence telling the user what to do next, or why something went wrong. Used by the UI and appended to serial error lines. */
export function getHint(board: BoardDefinition, state: BoardState): string {
  const nameOf = (id: string) => board.parts.find((part) => part.id === id)?.name ?? id;

  if (!state.isPowered) {
    const nextPart = requiredParts(board).find((part) => !state.placedPartIds.includes(part.id));
    if (nextPart) return `Next: place the ${nextPart.name} (${nextPart.description}).`;
    if (state.solderedPartIds.length < state.placedPartIds.length) return 'Solder every joint, then plug in USB.';
    return 'Everything is in place. Plug in USB to power the board.';
  }

  const result = state.lastResult;
  if (!result) return 'Powering up…';
  if (state.burnedPartIds.length > 0) {
    return `The ${nameOf(state.burnedPartIds[0])} burned out. Click it to remove it, fix the cause (${result.message}), then place a new one.`;
  }
  if (result.status === 'RUNNING') return `Running. Now try to break it: ${board.tryToBreakText}`;

  const gapPartId = getCurrentFlow(board, state).breakPartIds[0]; // where the red ✕ is drawn
  return gapPartId ? `Current stops at the ${nameOf(gapPartId)}. Place and solder it. (${result.message})` : result.message;
}
