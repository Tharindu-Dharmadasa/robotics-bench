// Page layout. This file arranges components and workbench views.
import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useBenchStore, useCurrentBoard } from './store/benchStore';
import { getBoardStatus, getGuidanceMessage } from './engine/boardStatus';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { BoardStage } from './components/BoardStage';
import { FlowLegend } from './components/FlowLegend';
import { PartsTray } from './components/PartsTray';
import { ControlBar } from './components/ControlBar';
import { CalcPanel } from './components/CalcPanel';
import { IdeDrawer } from './components/IdeDrawer';

const Stage3D = lazy(() => import('./components3d/Stage3D'));

export default function App() {
  const { board, boardState } = useCurrentBoard();
  const { uploadedBoardIds } = useBenchStore();
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [openCard, setOpenCard] = useState<'meet' | 'break' | null>('meet');

  const status = getBoardStatus(board, boardState);
  const guidanceMessage = getGuidanceMessage(board, boardState);

  // Lesson progress stages
  const requiredParts = board.parts.filter((p) => !p.isMistake);
  const allPlaced = requiredParts.every((p) => boardState.placedPartIds.includes(p.id));
  const allSoldered = requiredParts.every((p) => boardState.solderedPartIds.includes(p.id));
  const isPowered = boardState.isPowered;
  const isRunning = status === 'RUNNING';
  const hasCode = !!board.sketch;
  const isUploaded = uploadedBoardIds.includes(board.id);

  const steps = [
    { label: 'Place', done: allPlaced },
    { label: 'Solder', done: allSoldered },
    { label: 'Power', done: isPowered },
    ...(hasCode ? [{ label: 'Upload', done: isUploaded }] : []),
    { label: 'Verify', done: isRunning },
  ];

  const statusIcon =
    status === 'RUNNING'
      ? '✓'
      : status === 'FAULT'
      ? '⚠'
      : status === 'DEAD'
      ? '✕'
      : 'ℹ';

  const accentColor =
    status === 'RUNNING'
      ? 'var(--ok)'
      : status === 'FAULT' || status === 'DEAD'
      ? 'var(--bad)'
      : 'var(--accent)';

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 p-4 md:grid-cols-[230px_1fr] md:p-6">
        <Sidebar />
        <main className="space-y-4">
          {/* Header & Status */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)]/50 pb-3">
            <div>
              <small className="font-mono text-xs font-semibold text-[var(--accent)]">
                {board.figureLabel}
              </small>
              <h2 className="text-xl font-extrabold tracking-tight text-[var(--ink)]">
                {board.name}
              </h2>

              {/* Lesson Step Progress */}
              <div className="mt-2 flex items-center gap-2">
                {steps.map((step, idx) => (
                  <div key={step.label} className="flex items-center gap-1.5">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                        step.done
                          ? 'bg-[var(--ok)] text-white'
                          : 'bg-[var(--line)]/50 text-[var(--ink)]/60'
                      }`}
                    >
                      {step.done ? '✓' : idx + 1}
                    </span>
                    <span
                      className={`text-[11px] ${
                        step.done
                          ? 'font-semibold text-[var(--ok)]'
                          : 'opacity-60'
                      }`}
                    >
                      {step.label}
                    </span>
                    {idx < steps.length - 1 && (
                      <span className="text-[10px] opacity-30">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <StatusBar />
          </div>

          {/* Workbench Section */}
          <div className="grid gap-4 xl:grid-cols-[1fr_290px]">
            {/* View Pill Switcher */}
            <div id="stage-area" className="flex scroll-mt-4 items-center justify-between text-xs xl:col-start-1">
              <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
                {(['3d', '2d'] as const).map((mode) => {
                  const isActive = view === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setView(mode)}
                      className="relative rounded-md px-3.5 py-1 font-bold uppercase transition-colors"
                      style={{ color: isActive ? 'var(--paper)' : 'var(--ink)' }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="view-toggle"
                          className="absolute inset-0 rounded-md bg-[var(--ink)]"
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        />
                      )}
                      <span className="relative z-10">{mode} View</span>
                    </button>
                  );
                })}
              </div>

              <span className="text-[11px] opacity-60">
                {view === '3d' ? 'Interactive 3D Stage' : 'Schematic 2D Stage'}
              </span>
            </div>

            {/* Stage */}
            <div className="xl:col-start-1">
              <Suspense
                fallback={
                  <div className="grid h-[480px] place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                    <span className="animate-pulse text-xs font-semibold">Loading 3D Workbench…</span>
                  </div>
                }
              >
                {view === '3d' ? <Stage3D /> : <BoardStage />}
              </Suspense>
            </div>

            {/* Flow Legend */}
            <div className="xl:col-start-1">
              <FlowLegend />
            </div>

            {/* Parts Tray */}
            <PartsTray />

            {/* Controls */}
            <div className="xl:col-start-1">
              <ControlBar />
            </div>
          </div>

          {/* Toast-style Guidance Message */}
          <AnimatePresence mode="wait">
            <motion.div
              key={guidanceMessage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              aria-live="polite"
              className="flex items-center gap-3 rounded-lg border-l-4 bg-[var(--surface)] p-3 text-xs shadow-xs"
              style={{ borderColor: accentColor }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold text-white shadow-xs"
                style={{ background: accentColor }}
              >
                {statusIcon}
              </span>
              <p className="font-medium text-[var(--ink)]">{guidanceMessage}</p>
            </motion.div>
          </AnimatePresence>

          {/* Calculation Panel */}
          <CalcPanel />

          {/* Interactive Collapsible Cards */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* Card 1 */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-xs">
              <button
                type="button"
                onClick={() => setOpenCard(openCard === 'meet' ? null : 'meet')}
                className="flex w-full items-center justify-between text-left"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  Meet the Board
                </h3>
                <span className="text-xs opacity-60">
                  {openCard === 'meet' ? '▲' : '▼'}
                </span>
              </button>
              {openCard === 'meet' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 text-xs leading-relaxed opacity-85"
                >
                  {board.lessonText}
                </motion.div>
              )}
            </section>

            {/* Card 2 */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-xs">
              <button
                type="button"
                onClick={() => setOpenCard(openCard === 'break' ? null : 'break')}
                className="flex w-full items-center justify-between text-left"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--bad)]">
                  Try to Break It
                </h3>
                <span className="text-xs opacity-60">
                  {openCard === 'break' ? '▲' : '▼'}
                </span>
              </button>
              {openCard === 'break' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 text-xs leading-relaxed opacity-85"
                >
                  {board.tryToBreakText}
                </motion.div>
              )}
            </section>
          </div>

          {/* Slide-over IDE Modal/Drawer */}
          <IdeDrawer />
        </main>
      </div>
    </Tooltip.Provider>
  );
}
