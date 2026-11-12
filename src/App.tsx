// Page layout. This file only arranges components; the real work lives elsewhere.
import { lazy, Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useCurrentBoard } from "./store/benchStore";
import { getBoardStatus, getGuidanceMessage } from "./engine/boardStatus";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { BoardStage } from "./components/BoardStage";
import { FlowLegend } from "./components/FlowLegend";
import { PartsTray } from "./components/PartsTray";
import { ControlBar } from "./components/ControlBar";
// The 3D scene is loaded only when needed, so the 2D app stays light.
const Stage3D = lazy(() => import("./components3d/Stage3D"));

export default function App() {
  const { board, boardState } = useCurrentBoard();
  const [view, setView] = useState<"3d" | "2d">("3d");
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
      <div className="mx-auto grid min-h-screen max-w-7xl gap-5 p-4 md:grid-cols-[220px_1fr]">
        <Sidebar />
        <main className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <small className="opacity-60">{board.figureLabel}</small>
              <h2 className="text-xl font-bold">{board.name}</h2>
            </div>
            <StatusBar />
          </div>

          {/* THE WORKBENCH. A CSS grid with two columns on wide screens (xl): the board and its controls on the left,
              the parts tray on the right, spanning all four rows. On narrower screens it is a single column in DOM order:
              toggle, board, legend, TRAY, controls, so the parts are always directly under the board. */}
          <div className="grid gap-3 xl:grid-cols-[1fr_280px]">
            <div
              id="stage-area"
              className="flex scroll-mt-4 gap-2 text-xs xl:col-start-1"
            >
              {(["3d", "2d"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className="rounded-md border border-[var(--ink)] px-3 py-1 uppercase"
                  style={
                    view === mode
                      ? { background: "var(--ink)", color: "var(--paper)" }
                      : undefined
                  }
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="xl:col-start-1">
              <Suspense
                fallback={
                  <div className="grid h-[480px] place-items-center rounded-xl border border-[var(--line)]">
                    Loading 3D…
                  </div>
                }
              >
                {view === "3d" ? <Stage3D /> : <BoardStage />}
              </Suspense>
            </div>
            <div className="xl:col-start-1">
              <FlowLegend />
            </div>
            <PartsTray />
            <div className="xl:col-start-1">
              <ControlBar />
            </div>
          </div>

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
