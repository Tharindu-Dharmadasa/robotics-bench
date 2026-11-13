// Top-right readout: status, parts placed, joints left to solder, current draw.
import { motion } from 'framer-motion';
import { useCurrentBoard } from '../store/benchStore';
import { getBoardStatus } from '../engine/boardStatus';

export function StatusBar() {
  const { board, boardState } = useCurrentBoard();
  const status = getBoardStatus(board, boardState);
  const jointsLeftToSolder = boardState.placedPartIds.length - boardState.solderedPartIds.length;
  const isRunning = status === 'RUNNING';
  const isBad = status === 'FAULT' || status === 'DEAD';

  const badgeBg = isRunning
    ? 'bg-[var(--ok)]/15 text-[var(--ok)] border-[var(--ok)]'
    : isBad
    ? 'bg-[var(--bad)]/15 text-[var(--bad)] border-[var(--bad)]'
    : 'bg-[var(--line)]/30 text-[var(--ink)] border-[var(--line)]';

  const nonMistakeParts = board.parts.filter((p) => !p.isMistake);
  const placedNonMistake = boardState.placedPartIds.filter((id) =>
    nonMistakeParts.some((p) => p.id === id)
  ).length;

  return (
    <div className="flex flex-wrap items-center gap-4 text-right">
      {/* Dynamic Status Badge */}
      <motion.div
        key={status}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wider ${badgeBg}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isRunning ? 'bg-[var(--ok)] animate-ping' : isBad ? 'bg-[var(--bad)]' : 'bg-[var(--ink)] opacity-40'
          }`}
        />
        <span>{status}</span>
      </motion.div>

      {/* Numerical readouts */}
      <div className="flex gap-4 text-xs">
        <div>
          <small className="block text-[10px] uppercase tracking-widest opacity-60">Parts</small>
          <motion.b
            key={placedNonMistake}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="font-mono text-sm"
          >
            {placedNonMistake}/{nonMistakeParts.length}
          </motion.b>
        </div>

        <div>
          <small className="block text-[10px] uppercase tracking-widest opacity-60">To Solder</small>
          <motion.b
            key={jointsLeftToSolder}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className={`font-mono text-sm ${jointsLeftToSolder > 0 ? 'text-[var(--accent)]' : 'opacity-80'}`}
          >
            {jointsLeftToSolder}
          </motion.b>
        </div>

        <div>
          <small className="block text-[10px] uppercase tracking-widest opacity-60">Current</small>
          <motion.b
            key={boardState.lastResult?.currentMilliamps ?? 0}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="font-mono text-sm"
          >
            {boardState.lastResult?.currentMilliamps ?? 0} mA
          </motion.b>
        </div>
      </div>
    </div>
  );
}
