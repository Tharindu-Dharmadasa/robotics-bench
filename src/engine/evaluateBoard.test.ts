// Run with `npm test`. Each test builds a board with certain parts missing and checks the outcome.
import { describe, it, expect } from "vitest";
import { BOARDS, BOARDS_BY_ID } from "../data/boards";
import type { Condition } from "../data/types";
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

// ── Data checks that run against ALL boards ──
const partIdsUsedBy = (condition: Condition): string[] =>
  "partPresent" in condition
    ? [condition.partPresent]
    : "partMissing" in condition
      ? [condition.partMissing]
      : "not" in condition
        ? partIdsUsedBy(condition.not)
        : "allOf" in condition
          ? condition.allOf.flatMap(partIdsUsedBy)
          : "anyOf" in condition
            ? condition.anyOf.flatMap(partIdsUsedBy)
            : [];

describe("all boards", () => {
  it("there are 13 boards", () => expect(BOARDS).toHaveLength(13));
  BOARDS.forEach((board) => {
    it(`${board.name}: a complete build runs`, () => {
      const ids = board.parts
        .filter((part) => !part.isMistake)
        .map((part) => part.id);
      const result = evaluateBoard(board, {
        placedPartIds: ids,
        solderedPartIds: ids,
        burnedPartIds: [],
        isPowered: true,
        inputValues: Object.fromEntries(
          (board.inputs ?? []).map((input) => [input.id, true]),
        ),
        lastResult: null,
      });
      expect(result?.status).toBe("RUNNING");
    });
    it(`${board.name}: rules and effects only mention real parts`, () => {
      const realIds = new Set(board.parts.map((part) => part.id));
      board.rules.forEach((faultRule) =>
        [
          ...partIdsUsedBy(faultRule.condition),
          ...faultRule.litPartIds,
          ...faultRule.blinkingPartIds,
          ...faultRule.burnedPartIds,
        ].forEach((id) =>
          expect(realIds.has(id), `${board.id}: unknown part "${id}"`).toBe(
            true,
          ),
        ),
      );
    });
  });
});
