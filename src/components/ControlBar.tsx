// The row of action buttons under the board.
import { motion } from 'framer-motion';
import type { ComponentProps } from 'react';
import { useBenchStore, useCurrentBoard } from '../store/benchStore';

/** A button that lifts on hover and squishes when pressed. */
function ActionButton(props: ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="flex items-center gap-1.5 rounded-lg border border-[var(--ink)]/40 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors hover:border-[var(--ink)] hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
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
    toggleIde,
    uploadedBoardIds,
  } = useBenchStore();

  const isUploaded = uploadedBoardIds.includes(board.id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton disabled={isBusy} onClick={placeAllParts}>
        <span>📥</span> Place all parts
      </ActionButton>
      <ActionButton disabled={isBusy} onClick={solderAllParts}>
        <span>🔥</span> Solder joints
      </ActionButton>
      <ActionButton
        onClick={togglePower}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
          boardState.isPowered
            ? 'border-[var(--bad)] bg-[var(--bad)]/10 text-[var(--bad)] hover:bg-[var(--bad)]/20'
            : 'border-[var(--ok)] bg-[var(--ok)]/10 text-[var(--ok)] hover:bg-[var(--ok)]/20'
        }`}
      >
        <span>⚡</span> {boardState.isPowered ? 'Unplug USB' : 'Plug in USB'}
      </ActionButton>

      {/* Boards that define `inputs` (like the transistor board) get a HIGH/LOW toggle. */}
      {board.inputs?.map((input) => (
        <ActionButton key={input.id} onClick={() => toggleInput(input.id)}>
          <span>🎚</span> {input.label}:{' '}
          <strong className="font-mono">
            {boardState.inputValues[input.id] ? 'HIGH' : 'LOW'}
          </strong>
        </ActionButton>
      ))}

      <ActionButton onClick={resetBoard}>
        <span>↺</span> Reset
      </ActionButton>

      {/* IDE Code & Serial Monitor Drawer Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        onClick={toggleIde}
        className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--ink)] px-3.5 py-1.5 text-xs font-bold text-[var(--paper)] shadow-md transition-all hover:opacity-90"
      >
        <span>💻</span> Code & Serial
        {isUploaded && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" title="Sketch uploaded" />
        )}
      </motion.button>
    </div>
  );
}
