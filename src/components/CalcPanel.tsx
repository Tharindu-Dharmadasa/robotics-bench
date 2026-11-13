// "Live calculation": the working behind the result (Ohm's law etc.), taken from result.details.
import { AnimatePresence, motion } from 'framer-motion';
import { useCurrentBoard } from '../store/benchStore';

export function CalcPanel() {
  const { boardState } = useCurrentBoard();
  const details = boardState.lastResult?.details;

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-xs transition-all">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
          Live Circuit Calculation
        </h3>
        {details?.length ? (
          <span className="rounded-full bg-[var(--ok)]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--ok)]">
            Active Analysis
          </span>
        ) : null}
      </div>

      <AnimatePresence mode="wait">
        {details?.length ? (
          <motion.div
            key="details-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ul className="space-y-1.5 rounded-lg bg-[var(--paper)]/60 p-3 font-mono text-xs text-[var(--ink)]">
              {details.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="select-none text-[var(--accent)]">▸</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <motion.p
            key="empty-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs opacity-70"
          >
            Power the board to see live electrical calculations (Ohm’s law, voltage drops, power dissipation).
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
