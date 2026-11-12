// ─────────────────────────────────────────────────────────────────────────────
// Decides WHAT the serial monitor should say right now. Pure function: the
// component only adds the timing (printing the lines one by one).
// ─────────────────────────────────────────────────────────────────────────────
import type {BoardDefinition, BoardState} from '../data/types';

export interface SerialScript {
  lines: string[];     // what to print
  repeats: boolean;    // true = print the lines in a loop (a running sketch), false = print once
}

export function getSerialScript(board: BoardDefinition, state: BoardState, isUploaded: boolean): SerialScript {
  if (!board.sketch) return {lines: ['No microcontroller on this circuit, so there is no serial output.'], repeats: false};
  if (!isUploaded) return {lines: ['Waiting for a sketch. Plug in USB, then press "Upload sketch".'], repeats: false};
  const result = state.lastResult;
  if (!state.isPowered || !result) return {lines: ['Board is unpowered. Plug in USB.'], repeats: false};
  if (result.status === 'RUNNING') return {lines: board.serialOutput ?? ['(running)'], repeats: true};
  return {lines: [`!! ${result.message}`], repeats: false}; // "!!" marks an error line (shown in red)
}
