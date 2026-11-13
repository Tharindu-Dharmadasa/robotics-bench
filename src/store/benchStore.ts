import { create } from "zustand";
import { BOARDS, BOARDS_BY_ID } from "../data/boards";
import { evaluateBoard } from "../engine/evaluateBoard";
import type { BoardState } from "../data/types";
import { createIdeSlice, type IdeSlice } from "./ideSlice";

const createEmptyBoardState = (): BoardState => ({
  placedPartIds: [],
  solderedPartIds: [],
  burnedPartIds: [],
  isPowered: false,
  inputValues: {},
  lastResult: null,
});
const EMPTY_BOARD_STATE = createEmptyBoardState();
const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const DELAY_BETWEEN_STEPS_MS = 330;

/** The bench itself: boards, parts, power. */
interface BenchCore {
  currentBoardId: string;
  boardStates: Record<string, BoardState>;
  hoveredPartId: string | null;
  isBusy: boolean;
  selectBoard: (boardId: string) => void;
  togglePart: (partId: string) => void;
  placeAllParts: () => Promise<void>;
  solderAllParts: () => Promise<void>;
  togglePower: () => void;
  setPartValue: (partId: string, value: number | string) => void;
  toggleInput: (inputId: string) => void;
  resetBoard: () => void;
  setHoveredPart: (partId: string | null) => void;
}

/** The whole store = the bench + the IDE. */
export type BenchStore = BenchCore & IdeSlice;

export const useBenchStore = create<BenchStore>((set, get, api) => {
  const getCurrentBoardState = () =>
    get().boardStates[get().currentBoardId] ?? EMPTY_BOARD_STATE;

  const updateCurrentBoard = (
    applyChange: (previous: BoardState) => BoardState,
  ) =>
    set((store) => {
      const board = BOARDS_BY_ID[store.currentBoardId];
      let next = applyChange(
        store.boardStates[store.currentBoardId] ?? EMPTY_BOARD_STATE,
      );
      const result = evaluateBoard(board, next);
      if (result?.burnedPartIds.length) {
        next = {
          ...next,
          burnedPartIds: [
            ...new Set([...next.burnedPartIds, ...result.burnedPartIds]),
          ],
        };
      }
      return {
        boardStates: {
          ...store.boardStates,
          [board.id]: { ...next, lastResult: result },
        },
      };
    });

  const runStepByStep = async (
    shouldApply: (state: BoardState, partId: string) => boolean,
    change: (state: BoardState, partId: string) => BoardState,
  ) => {
    if (get().isBusy) return;
    set({ isBusy: true });
    for (const part of BOARDS_BY_ID[get().currentBoardId].parts) {
      if (shouldApply(getCurrentBoardState(), part.id)) {
        updateCurrentBoard((state) => change(state, part.id));
        await wait(DELAY_BETWEEN_STEPS_MS);
      }
    }
    set({ isBusy: false });
  };

  return {
    currentBoardId: BOARDS[0].id,
    boardStates: {},
    hoveredPartId: null,
    isBusy: false,

    selectBoard: (boardId) => set({ currentBoardId: boardId }),

    togglePart: (partId) =>
      updateCurrentBoard((state) =>
        state.placedPartIds.includes(partId)
          ? {
            ...state,
            placedPartIds: state.placedPartIds.filter((id) => id !== partId),
            solderedPartIds: state.solderedPartIds.filter(
              (id) => id !== partId,
            ),
            burnedPartIds: state.burnedPartIds.filter((id) => id !== partId),
          }
          : { ...state, placedPartIds: [...state.placedPartIds, partId] },
      ),

    placeAllParts: () =>
      runStepByStep(
        (state, id) =>
          !state.placedPartIds.includes(id) &&
          !BOARDS_BY_ID[get().currentBoardId].parts.find(
            (part) => part.id === id,
          )?.isMistake,
        (state, id) => ({
          ...state,
          placedPartIds: [...state.placedPartIds, id],
        }),
      ),

    solderAllParts: () =>
      runStepByStep(
        (state, id) =>
          state.placedPartIds.includes(id) &&
          !state.solderedPartIds.includes(id),
        (state, id) => ({
          ...state,
          solderedPartIds: [...state.solderedPartIds, id],
        }),
      ),

    setPartValue: (partId, value) =>
      updateCurrentBoard((state) => ({
        ...state,
        partValues: { ...state.partValues, [partId]: value },
      })),
    togglePower: () =>
      updateCurrentBoard((state) => ({
        ...state,
        isPowered: !state.isPowered,
      })),
    toggleInput: (inputId) =>
      updateCurrentBoard((state) => ({
        ...state,
        inputValues: {
          ...state.inputValues,
          [inputId]: !state.inputValues[inputId],
        },
      })),

    resetBoard: () => {
      get().stopTelemetry();
      set((store) => ({
        uploadedBoardIds: store.uploadedBoardIds.filter(
          (id) => id !== store.currentBoardId,
        ),
      })); // a reset wipes the sketch too
      updateCurrentBoard(() => createEmptyBoardState());
    },
    setHoveredPart: (partId) => set({ hoveredPartId: partId }),

    ...createIdeSlice(set, get, api), // adds isIdeOpen, serialLog, uploadSketch, sendSerialCommand...
  };
});

export function useCurrentBoard() {
  const boardId = useBenchStore((store) => store.currentBoardId);
  const boardState =
    useBenchStore((store) => store.boardStates[boardId]) ?? EMPTY_BOARD_STATE;
  return { board: BOARDS_BY_ID[boardId], boardState };
}
