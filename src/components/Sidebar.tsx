// Left column: just the list of boards. (The parts now live in PartsTray, next to the board.)
import { motion } from "framer-motion";
import { BOARDS } from "../data/boards";
import { useBenchStore } from "../store/benchStore";

export function Sidebar() {
  const { currentBoardId, selectBoard } = useBenchStore();

  const handleSelect = (boardId: string) => {
    selectBoard(boardId);
    // On phones the board list is stacked ABOVE the board, so bring the board (and its parts) into view.
    if (window.matchMedia("(max-width: 767px)").matches) {
      document
        .getElementById("stage-area")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside className="space-y-3">
      <h1 className="text-sm font-bold uppercase tracking-widest">
        Robotics Bench
      </h1>
      <nav className="space-y-1">
        {BOARDS.map((item) => {
          const isSelected = item.id === currentBoardId;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className="relative block w-full rounded-md px-3 py-1.5 text-left"
            >
              {/* layoutId makes this dark highlight SLIDE from the old selection to the new one. */}
              {isSelected && (
                <motion.span
                  layoutId="selected-board"
                  className="absolute inset-0 rounded-md bg-[var(--ink)]"
                />
              )}
              <span
                className="relative"
                style={{ color: isSelected ? "var(--paper)" : undefined }}
              >
                {item.name}
                <small className="block opacity-60">{item.figureLabel}</small>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
