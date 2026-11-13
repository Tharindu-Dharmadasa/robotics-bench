// Left column: list of boards with status indicators.
import { motion } from 'framer-motion';
import { BOARDS } from '../data/boards';
import { useBenchStore } from '../store/benchStore';
import { getBoardStatus } from '../engine/boardStatus';

export function Sidebar() {
  const { currentBoardId, selectBoard, boardStates } = useBenchStore();

  const handleSelect = (boardId: string) => {
    selectBoard(boardId);
    if (window.matchMedia('(max-width: 767px)').matches) {
      document
        .getElementById('stage-area')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <div>
          <h1 className="text-sm font-black uppercase tracking-wider text-[var(--ink)]">
            Robotics Bench
          </h1>
          <p className="text-[11px] opacity-60">Circuit Simulation Lab</p>
        </div>
      </div>

      <nav className="space-y-1">
        {BOARDS.map((item) => {
          const isSelected = item.id === currentBoardId;
          const boardState = boardStates[item.id];
          const status = boardState ? getBoardStatus(item, boardState) : 'ASSEMBLING';

          const isCompleted = status === 'RUNNING';
          const isInProgress =
            boardState &&
            (boardState.placedPartIds.length > 0 || boardState.isPowered);

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className="relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface)]"
            >
              {isSelected && (
                <motion.span
                  layoutId="selected-board"
                  className="absolute inset-0 rounded-lg bg-[var(--ink)]"
                  transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                />
              )}
              <span
                className="relative z-10 block pr-2"
                style={{ color: isSelected ? 'var(--paper)' : undefined }}
              >
                <span className="block text-xs font-semibold leading-tight">
                  {item.name}
                </span>
                <small className="block text-[10px] opacity-60">
                  {item.figureLabel}
                </small>
              </span>

              {/* Status Indicator Dot */}
              <span className="relative z-10 flex shrink-0 items-center">
                {isCompleted ? (
                  <span
                    className="h-2 w-2 rounded-full bg-[var(--ok)] shadow-xs"
                    title="Board verified & running"
                  />
                ) : isInProgress ? (
                  <span
                    className="h-2 w-2 rounded-full bg-[var(--accent)]"
                    title="In progress"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
