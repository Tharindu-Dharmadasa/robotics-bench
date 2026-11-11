// Page layout. This file only arranges components; the real work lives elsewhere.
import { AnimatePresence, motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useCurrentBoard } from "./store/benchStore";
import { getBoardStatus, getGuidanceMessage } from "./engine/boardStatus";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { BoardStage } from "./components/BoardStage";
import { ControlBar } from "./components/ControlBar";

export default function App() {
  const { board, boardState } = useCurrentBoard();
  const status = getBoardStatus(board, boardState);
  const guidanceMessage = getGuidanceMessage(board, boardState);
  const accentColor =
    status === "RUNNING"
      ? "var(--ok)"
      : status === "FAULT" || status === "DEAD"
        ? "var(--bad)"
        : "var(--ink)";

  return (
    // Tooltip.Provider is required once at the top by Radix for all tooltips below.
    <Tooltip.Provider delayDuration={120}>
      <div className="mx-auto grid min-h-screen max-w-6xl gap-5 p-4 md:grid-cols-[250px_1fr]">
        <Sidebar />
        <main className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <small className="opacity-60">{board.figureLabel}</small>
              <h2 className="text-xl font-bold">{board.name}</h2>
            </div>
            <StatusBar />
          </div>
          <BoardStage />
          <ControlBar />

          {/* The message cross-fades whenever its text changes (key={message} tells Framer it is a "new" element). */}
          <AnimatePresence mode="wait">
            <motion.p
              key={guidanceMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              aria-live="polite"
              className="rounded-md border-l-4 bg-[var(--surface)] p-3"
              style={{ borderColor: accentColor }}
            >
              {guidanceMessage}
            </motion.p>
          </AnimatePresence>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Meet the board", board.lessonText],
              ["Try to break it", board.tryToBreakText],
            ].map(([title, text]) => (
              <section
                key={title}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
              >
                <h3 className="mb-1 text-xs uppercase tracking-widest text-[var(--accent)]">
                  {title}
                </h3>
                {text}
              </section>
            ))}
          </div>
        </main>
      </div>
    </Tooltip.Provider>
  );
}
