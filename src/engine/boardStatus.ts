// Helpers that turn raw progress into the words shown in the UI. Pure functions.
import type { BoardDefinition, BoardState, BoardStatus } from "../data/types";

/** Mistake parts are optional, so only the other parts must be placed before the board counts as assembled. */
const hasUnplacedRequiredParts = (board: BoardDefinition, state: BoardState) =>
  board.parts.some(
    (part) => !part.isMistake && !state.placedPartIds.includes(part.id),
  );

/** The status chip. After power-on the rules decide; before that it reflects build progress. */
export function getBoardStatus(
  board: BoardDefinition,
  state: BoardState,
): BoardStatus {
  if (state.isPowered && state.lastResult) return state.lastResult.status;
  if (hasUnplacedRequiredParts(board, state)) return "ASSEMBLING";
  if (state.solderedPartIds.length < state.placedPartIds.length)
    return "NEEDS SOLDER";
  return "READY";
}

/** The helper sentence under the board: tells the user what to do next, or why something happened. */
export function getGuidanceMessage(
  board: BoardDefinition,
  state: BoardState,
): string {
  if (state.isPowered && state.lastResult) return state.lastResult.message;
  if (hasUnplacedRequiredParts(board, state))
    return "Click part names, or the parts themselves, to place them on the board.";
  if (state.solderedPartIds.length < state.placedPartIds.length)
    return "Solder the joints, then plug in USB.";
  return "All soldered. Plug in USB to power the board.";
}
