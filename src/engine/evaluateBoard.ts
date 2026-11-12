// ─────────────────────────────────────────────────────────────────────────────
// The simulation "brain". Pure TypeScript: no React, no browser, easy to test.
// Given a board and the user's progress, it answers: "what happens now?"
// ─────────────────────────────────────────────────────────────────────────────
import type {
  BoardDefinition,
  BoardState,
  Condition,
  SimulationResult,
} from "../data/types";

export function evaluateBoard(
  board: BoardDefinition,
  state: BoardState,
): SimulationResult | null {
  // Nothing happens until the user plugs in power.
  if (!state.isPowered) return null;

  // KEY IDEA: a part only counts electrically if it is placed AND soldered AND not burned.
  // This one rule makes placing, soldering, removing and burning all behave consistently.
  const workingPartIds = new Set(
    board.parts
      .map((part) => part.id)
      .filter(
        (id) =>
          state.placedPartIds.includes(id) &&
          state.solderedPartIds.includes(id) &&
          !state.burnedPartIds.includes(id),
      ),
  );

  // Recursively checks a condition against the working parts and the user's input toggles.
  const conditionIsTrue = (condition: Condition): boolean => {
    if ("partPresent" in condition)
      return workingPartIds.has(condition.partPresent);
    if ("partMissing" in condition)
      return !workingPartIds.has(condition.partMissing);
    if ("inputIsOn" in condition)
      return Boolean(state.inputValues[condition.inputIsOn]);
    if ("not" in condition) return !conditionIsTrue(condition.not);
    if ("allOf" in condition) return condition.allOf.every(conditionIsTrue);
    return condition.anyOf.some(conditionIsTrue);
  };

  // The first rule whose condition is true decides the outcome.
  const matchingRule = board.rules.find((faultRule) =>
    conditionIsTrue(faultRule.condition),
  );
  if (!matchingRule) {
    return {
      status: "IDLE",
      message: "Nothing happens.",
      currentMilliamps: 0,
      litPartIds: [],
      blinkingPartIds: [],
      burnedPartIds: [],
    };
  }
  const { condition: _unused, ...result } = matchingRule; // drop the condition, keep the outcome
  return result;
}
