// ─────────────────────────────────────────────────────────────────────────────
// The parts tray: every part of the CURRENT board, shown right beside the board
// (on wide screens) or right under it (on narrow ones), so the user never has to
// scroll to find a part. Click a card to place the part, click again to remove it.
// It only READS the store and calls togglePart: the board animates by itself.
// ─────────────────────────────────────────────────────────────────────────────
import {motion} from 'framer-motion';
import {useBenchStore, useCurrentBoard} from '../store/benchStore';
import type {PartDefinition, PartKind} from '../data/types';

/** A small symbol on each card so parts are recognisable at a glance. */
const KIND_GLYPHS: Record<PartKind, string> = {
  resistor: '▭', led: '●', chip: '▦', capacitor: '◍', header: '⋮', terminal: '⎍',
  heatsink: '≋', relay: '▣', motor: '◎', connector: '⌸', eye: '◉', block: '■',
};

export function PartsTray() {
  const {board, boardState} = useCurrentBoard();
  const {togglePart, hoveredPartId, setHoveredPart} = useBenchStore();

  const requiredParts = board.parts.filter((part) => !part.isMistake);
  const mistakeParts = board.parts.filter((part) => part.isMistake);
  const placedCount = requiredParts.filter((part) => boardState.placedPartIds.includes(part.id)).length;

  /** One clickable card. `index` staggers the entrance animation. */
  const renderCard = (part: PartDefinition, index: number) => {
    const isPlaced = boardState.placedPartIds.includes(part.id);
    const isSoldered = boardState.solderedPartIds.includes(part.id);
    const isBurned = boardState.burnedPartIds.includes(part.id);
    const isHovered = hoveredPartId === part.id;
    const statusText = isBurned ? 'burnt: click to replace' : isSoldered ? 'soldered' : isPlaced ? 'placed: needs solder' : part.isMistake ? 'click to add this mistake' : 'click to place';
    const statusColor = isBurned || (part.isMistake && !isPlaced) ? 'var(--bad)' : isPlaced ? 'var(--ok)' : 'var(--accent)';
    return (
      <motion.button key={part.id} type="button" aria-pressed={isPlaced}
        initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} transition={{delay: index * 0.04}}
        whileHover={{y: -2}} whileTap={{scale: 0.97}}
        onClick={() => togglePart(part.id)}
        onMouseEnter={() => setHoveredPart(part.id)} onMouseLeave={() => setHoveredPart(null)}
        onFocus={() => setHoveredPart(part.id)} onBlur={() => setHoveredPart(null)}
        className="flex items-center gap-3 rounded-lg bg-[var(--surface)] p-2 text-left outline-none"
        // Dashed = not on the board yet, solid = on the board. The border turns orange while the part is hovered.
        style={{border: `2px ${isPlaced ? 'solid' : 'dashed'} ${isHovered ? 'var(--accent)' : isPlaced ? 'var(--ok)' : 'var(--line)'}`}}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-lg text-white" style={{background: part.color, textShadow: '0 1px 2px #000'}}>{KIND_GLYPHS[part.kind]}</span>
        <span className="min-w-0">
          <b className="block truncate text-sm">{part.name}</b>
          <span className="block truncate text-xs opacity-60">{part.description}</span>
          <span className="text-xs" style={{color: statusColor}}>{statusText}</span>
        </span>
      </motion.button>
    );
  };

  // Mobile/tablet: a wrapping grid under the board. Wide screens (xl): a single column to the right of it.
  const gridClasses = 'grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2 xl:grid-cols-1';

  return (
    <aside aria-label="Parts tray" className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 xl:col-start-2 xl:row-start-1 xl:row-span-4 xl:max-h-[640px] xl:overflow-y-auto">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-widest text-[var(--accent)]">Parts for this board</h2>
        <span className="text-xs opacity-70">{placedCount}/{requiredParts.length} placed</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <motion.div className="h-full bg-[var(--ok)]" animate={{width: `${(placedCount / requiredParts.length) * 100}%`}} />
      </div>

      {/* key={board.id}: when you pick another board this block remounts, so the cards animate in again. */}
      <motion.div key={board.id} className="space-y-3">
        <div className={gridClasses}>{requiredParts.map(renderCard)}</div>
        {mistakeParts.length > 0 && (<>
          <h3 className="text-xs uppercase tracking-widest text-[var(--bad)]">Mistakes: add on purpose</h3>
          <div className={gridClasses}>{mistakeParts.map((part, i) => renderCard(part, i + requiredParts.length))}</div>
        </>)}
      </motion.div>
    </aside>
  );
}
