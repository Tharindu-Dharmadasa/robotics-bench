// Left column: the list of boards, and the "parts bin" for the selected board.
import {motion} from 'framer-motion';
import {BOARDS} from '../data/boards';
import {useBenchStore, useCurrentBoard} from '../store/benchStore';

export function Sidebar() {
  const {currentBoardId, selectBoard, togglePart, hoveredPartId, setHoveredPart} = useBenchStore();
  const {board, boardState} = useCurrentBoard();

  return (
    <aside className="space-y-3">
      <h1 className="text-sm font-bold uppercase tracking-widest">Robotics Bench</h1>

      <nav className="space-y-1">
        {BOARDS.map((item) => {
          const isSelected = item.id === currentBoardId;
          return (
            <button key={item.id} onClick={() => selectBoard(item.id)} className="relative block w-full rounded-md px-3 py-2 text-left">
              {/* layoutId makes this dark highlight SLIDE from the old selection to the new one. */}
              {isSelected && <motion.span layoutId="selected-board" className="absolute inset-0 rounded-md bg-[var(--ink)]" />}
              <span className="relative" style={{color: isSelected ? 'var(--paper)' : undefined}}>
                {item.name}<small className="block opacity-60">{item.figureLabel}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <h2 className="pt-2 text-xs uppercase tracking-widest text-[var(--accent)]">Parts bin</h2>
      <ul className="space-y-1.5">
        {board.parts.map((part) => {
          const isPlaced = boardState.placedPartIds.includes(part.id);
          const isBurned = boardState.burnedPartIds.includes(part.id);
          const isSoldered = boardState.solderedPartIds.includes(part.id);
          const badgeText = isBurned ? 'burnt: click to replace' : isSoldered ? 'soldered' : isPlaced ? 'placed: needs solder' : part.isMistake ? 'mistake: place it to see what breaks' : 'click to place';
          const badgeColor = isBurned || (part.isMistake && !isPlaced) ? 'var(--bad)' : isPlaced ? 'var(--ok)' : 'var(--accent)';
          return (
            <motion.li key={part.id} whileHover={{x: 4}} whileTap={{scale: 0.98}}
              onClick={() => togglePart(part.id)}
              onMouseEnter={() => setHoveredPart(part.id)} onMouseLeave={() => setHoveredPart(null)}
              className="cursor-pointer rounded-md border bg-[var(--surface)] px-3 py-2"
              style={{borderColor: hoveredPartId === part.id ? 'var(--accent)' : 'var(--line)'}}>
              <b>{part.name}</b>
              <span className="block text-xs opacity-60">{part.description}</span>
              <span className="text-xs" style={{color: badgeColor}}>{badgeText}</span>
            </motion.li>
          );
        })}
      </ul>
    </aside>
  );
}
