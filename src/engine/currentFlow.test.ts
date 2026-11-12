import { describe, it, expect } from "vitest";
import { BOARDS, BOARDS_BY_ID } from "../data/boards";
import { evaluateBoard } from "./evaluateBoard";
import { getCurrentFlow } from "./currentFlow";
import type { BoardState } from "../data/types";

/** A powered board with every part placed and soldered except those in `omitted`. */
function poweredState(boardId: string, omitted: string[] = []): BoardState {
  const board = BOARDS_BY_ID[boardId];
  const ids = board.parts
    .filter((part) => !part.isMistake && !omitted.includes(part.id))
    .map((part) => part.id);
  const state: BoardState = {
    placedPartIds: ids,
    solderedPartIds: ids,
    burnedPartIds: [],
    isPowered: true,
    inputValues: { signal: true },
    lastResult: null,
  };
  return { ...state, lastResult: evaluateBoard(board, state) };
}

describe("current flow", () => {
  it("flows through the whole LED circuit when it runs", () => {
    const flow = getCurrentFlow(BOARDS_BY_ID.led, poweredState("led"));
    expect(flow.mode).toBe("normal");
    expect(flow.segments.every((segment) => segment.isLive)).toBe(true);
    expect(flow.breakPartIds).toEqual([]);
  });
  it("stops at the missing LED and marks the break", () => {
    const flow = getCurrentFlow(BOARDS_BY_ID.led, poweredState("led", ["led"]));
    expect(flow.segments.map((segment) => segment.isLive)).toEqual([
      true,
      false,
    ]); // power→resistor live, resistor→led dead
    expect(flow.breakPartIds).toEqual(["led"]);
  });
  it("surges when a part burns", () => {
    const state = poweredState("led", ["resistor"]);
    expect(
      getCurrentFlow(BOARDS_BY_ID.led, { ...state, burnedPartIds: ["led"] })
        .mode,
    ).toBe("surge");
  });
  it("nothing flows while unpowered", () => {
    const state = {
      ...poweredState("led"),
      isPowered: false,
      lastResult: null,
    };
    expect(getCurrentFlow(BOARDS_BY_ID.led, state).mode).toBe("off");
  });
  it("every board route uses real, non-mistake parts", () => {
    BOARDS.forEach((board) =>
      board.currentPaths.flat().forEach((id) => {
        const part = board.parts.find((candidate) => candidate.id === id);
        expect(
          part && !part.isMistake,
          `${board.id}: bad route part "${id}"`,
        ).toBe(true);
      }),
    );
  });
});
