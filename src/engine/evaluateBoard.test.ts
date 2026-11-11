// Run with `npm test`. Each test builds a board with certain parts missing and checks the outcome.
import { describe, it, expect } from "vitest";
import { BOARDS_BY_ID } from "../data/boards";
import { evaluateBoard } from "./evaluateBoard";

/** Builds a powered board with every part placed (and soldered, unless told otherwise) except `omittedPartIds`. */
function poweredBoard(
  boardId: string,
  omittedPartIds: string[] = [],
  isSoldered = true,
) {
  const board = BOARDS_BY_ID[boardId];
  const partIds = board.parts
    .map((part) => part.id)
    .filter((id) => !omittedPartIds.includes(id));
  return evaluateBoard(board, {
    placedPartIds: partIds,
    solderedPartIds: isSoldered ? partIds : [],
    burnedPartIds: [],
    isPowered: true,
    inputValues: { signal: true },
    lastResult: null,
  })!;
}

describe("rules engine", () => {
  it("LED lights when the circuit is complete", () => {
    const result = poweredBoard("led");
    expect(result.status).toBe("RUNNING");
    expect(result.litPartIds).toEqual(["led"]);
  });
  it("LED burns without its resistor", () => {
    const result = poweredBoard("led", ["resistor"]);
    expect(result.status).toBe("FAULT");
    expect(result.burnedPartIds).toEqual(["led"]);
  });
  it("unsoldered parts count as missing", () =>
    expect(poweredBoard("led", [], false).status).toBe("DEAD"));
  it("transistor dies without a base resistor", () =>
    expect(poweredBoard("transistor", ["baseResistor"]).burnedPartIds).toEqual([
      "transistor",
    ]));
  it("Arduino halts without its crystal", () =>
    expect(poweredBoard("uno", ["crystal"]).status).toBe("FAULT"));
  it("Arduino blinks when complete", () =>
    expect(poweredBoard("uno").blinkingPartIds).toEqual(["pin13Led"]));
});
