// ─────────────────────────────────────────────────────────────────────────────
// App state (Zustand). Components READ state from here and call these ACTIONS
// to change it. Every change re-runs the engine, so the UI is always consistent.
// ─────────────────────────────────────────────────────────────────────────────
import {create} from 'zustand';
import {BOARDS, BOARDS_BY_ID} from '../data/boards';
import {evaluateBoard} from '../engine/evaluateBoard';
import type {BoardState} from '../data/types';

/** A brand-new, empty board: nothing placed, nothing soldered, no power. */
const createEmptyBoardState = (): BoardState => ({
  placedPartIds: [], solderedPartIds: [], burnedPartIds: [], isPowered: false, inputValues: {}, lastResult: null,
});
const EMPTY_BOARD_STATE = createEmptyBoardState(); // shared fallback so selectors return a stable object
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const DELAY_BETWEEN_STEPS_MS = 330; // pause between "place all" / "solder all" steps so the animations are visible

interface BenchStore {
  currentBoardId: string;
  boardStates: Record<string, BoardState>;   // progress is remembered separately for each board
  hoveredPartId: string | null;              // lets the parts bin and the stage highlight the same part
  isBusy: boolean;                           // true while a step-by-step action is running

  selectBoard: (boardId: string) => void;
  togglePart: (partId: string) => void;      // place it, or remove it if already placed
  placeAllParts: () => Promise<void>;
  solderAllParts: () => Promise<void>;
  togglePower: () => void;
  toggleInput: (inputId: string) => void;
  resetBoard: () => void;
  setHoveredPart: (partId: string | null) => void;
}

export const useBenchStore = create<BenchStore>((set, get) => {
  const getCurrentBoardState = () => get().boardStates[get().currentBoardId] ?? EMPTY_BOARD_STATE;

  /**
   * The ONE place where board progress changes.
   * 1) apply the change  2) run the engine  3) remember parts that burned  4) save.
   */
  const updateCurrentBoard = (applyChange: (previous: BoardState) => BoardState) =>
    set((store) => {
      const board = BOARDS_BY_ID[store.currentBoardId];
      let next = applyChange(store.boardStates[store.currentBoardId] ?? EMPTY_BOARD_STATE);
      const result = evaluateBoard(board, next);
      if (result?.burnedPartIds.length) {
        // Burned parts stay burned until the user removes and replaces them.
        next = {...next, burnedPartIds: [...new Set([...next.burnedPartIds, ...result.burnedPartIds])]};
      }
      return {boardStates: {...store.boardStates, [board.id]: {...next, lastResult: result}}};
    });

  /** Applies `change` to each matching part one at a time, with a pause, so the user sees each animation. */
  const runStepByStep = async (
    shouldApply: (state: BoardState, partId: string) => boolean,
    change: (state: BoardState, partId: string) => BoardState,
  ) => {
    if (get().isBusy) return; // ignore double-clicks
    set({isBusy: true});
    for (const part of BOARDS_BY_ID[get().currentBoardId].parts) {
      if (shouldApply(getCurrentBoardState(), part.id)) {
        updateCurrentBoard((state) => change(state, part.id));
        await wait(DELAY_BETWEEN_STEPS_MS);
      }
    }
    set({isBusy: false});
  };

  return {
    currentBoardId: BOARDS[0].id, boardStates: {}, hoveredPartId: null, isBusy: false,

    selectBoard: (boardId) => set({currentBoardId: boardId}),

    togglePart: (partId) => updateCurrentBoard((state) =>
      state.placedPartIds.includes(partId)
        // Removing a part also un-solders it and clears any burn damage.
        ? {...state,
            placedPartIds: state.placedPartIds.filter((id) => id !== partId),
            solderedPartIds: state.solderedPartIds.filter((id) => id !== partId),
            burnedPartIds: state.burnedPartIds.filter((id) => id !== partId)}
        : {...state, placedPartIds: [...state.placedPartIds, partId]}),

    placeAllParts: () => runStepByStep(
      (state, id) => !state.placedPartIds.includes(id),
      (state, id) => ({...state, placedPartIds: [...state.placedPartIds, id]})),

    solderAllParts: () => runStepByStep(
      (state, id) => state.placedPartIds.includes(id) && !state.solderedPartIds.includes(id),
      (state, id) => ({...state, solderedPartIds: [...state.solderedPartIds, id]})),

    togglePower: () => updateCurrentBoard((state) => ({...state, isPowered: !state.isPowered})),
    toggleInput: (inputId) => updateCurrentBoard((state) => ({...state, inputValues: {...state.inputValues, [inputId]: !state.inputValues[inputId]}})),
    resetBoard: () => updateCurrentBoard(() => createEmptyBoardState()),
    setHoveredPart: (partId) => set({hoveredPartId: partId}),
  };
});

/** Convenience hook: the board being viewed plus the user's progress on it. */
export function useCurrentBoard() {
  const boardId = useBenchStore((store) => store.currentBoardId);
  const boardState = useBenchStore((store) => store.boardStates[boardId]) ?? EMPTY_BOARD_STATE;
  return {board: BOARDS_BY_ID[boardId], boardState};
}
