// The row of action buttons under the board.
import { motion } from "framer-motion";
import type { ComponentProps } from "react";
import { useBenchStore, useCurrentBoard } from "../store/benchStore";

/** A button that lifts on hover and squishes when pressed. */
function ActionButton(props: ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="rounded-md border-[1.5px] border-[var(--ink)] bg-[var(--surface)] px-3 py-2 disabled:opacity-40"
      {...props}
    />
  );
}

export function ControlBar() {
  const { board, boardState } = useCurrentBoard();
  const {
    isBusy,
    placeAllParts,
    solderAllParts,
    togglePower,
    toggleInput,
    resetBoard,
  } = useBenchStore();
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton disabled={isBusy} onClick={placeAllParts}>
        Place all parts
      </ActionButton>
      <ActionButton disabled={isBusy} onClick={solderAllParts}>
        Solder joints
      </ActionButton>
      <ActionButton onClick={togglePower}>
        {boardState.isPowered ? "Unplug USB" : "Plug in USB"}
      </ActionButton>
      {/* Boards that define `inputs` (like the transistor board) get a HIGH/LOW toggle. */}
      {board.inputs?.map((input) => (
        <ActionButton key={input.id} onClick={() => toggleInput(input.id)}>
          {input.label}: {boardState.inputValues[input.id] ? "HIGH" : "LOW"}
        </ActionButton>
      ))}
      <ActionButton onClick={resetBoard}>Reset</ActionButton>
    </div>
  );
}
