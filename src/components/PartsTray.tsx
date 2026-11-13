// ─────────────────────────────────────────────────────────────────────────────
// The parts tray: every part of the CURRENT board, shown right beside the board
// (on wide screens) or right under it (on narrow ones), so the user never has to
// scroll to find a part. Click a card to place the part, click again to remove it.
// It only READS the store and calls togglePart: the board animates by itself.
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { useBenchStore, useCurrentBoard } from '../store/benchStore';
import type { PartDefinition, PartKind } from '../data/types';
import { getEffectivePart } from '../data/parameters';
import { ValueSelectors } from './ValueSelectors';

/** A small symbol on each card so parts are recognisable at a glance. */
const KIND_GLYPHS: Record<PartKind, string> = {
  resistor: '▭',
  led: '●',
  chip: '▦',
  capacitor: '◍',
  header: '⋮',
  terminal: '⎍',
  heatsink: '≋',
  relay: '▣',
  motor: '◎',
  connector: '⌸',
  eye: '◉',
  block: '■',
};

export function PartsTray() {
  const { board, boardState } = useCurrentBoard();
  const { togglePart, hoveredPartId, setHoveredPart } = useBenchStore();

  const requiredParts = board.parts
    .filter((part) => !part.isMistake)
    .map((part) => getEffectivePart(part, boardState.partValues));
  const mistakeParts = board.parts.filter((part) => part.isMistake);
  const placedCount = requiredParts.filter((part) =>
    boardState.placedPartIds.includes(part.id)
  ).length;

  /** One clickable card. `index` staggers the entrance animation. */
  const renderCard = (part: PartDefinition, index: number) => {
    const isPlaced = boardState.placedPartIds.includes(part.id);
    const isSoldered = boardState.solderedPartIds.includes(part.id);
    const isBurned = boardState.burnedPartIds.includes(part.id);
    const isHovered = hoveredPartId === part.id;

    let statusBadgeText = 'Click to place';
    let statusBadgeClass = 'bg-[var(--line)]/20 text-[var(--ink)]/80';
    let borderStatus = 'border-l-[var(--line)]';

    if (isBurned) {
      statusBadgeText = 'Burnt ✕ Click to replace';
      statusBadgeClass = 'bg-[var(--bad)]/15 text-[var(--bad)] font-bold';
      borderStatus = 'border-l-[var(--bad)]';
    } else if (isSoldered) {
      statusBadgeText = '✓ Soldered';
      statusBadgeClass = 'bg-[var(--ok)]/15 text-[var(--ok)] font-medium';
      borderStatus = 'border-l-[var(--ok)]';
    } else if (isPlaced) {
      statusBadgeText = 'Placed • Needs solder';
      statusBadgeClass = 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium';
      borderStatus = 'border-l-[var(--accent)]';
    } else if (part.isMistake) {
      statusBadgeText = '+ Add mistake part';
      statusBadgeClass = 'bg-[var(--bad)]/10 text-[var(--bad)]';
      borderStatus = 'border-l-[var(--bad)]/60';
    }

    return (
      <motion.button
        key={part.id}
        type="button"
        aria-pressed={isPlaced}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => togglePart(part.id)}
        onMouseEnter={() => setHoveredPart(part.id)}
        onMouseLeave={() => setHoveredPart(null)}
        onFocus={() => setHoveredPart(part.id)}
        onBlur={() => setHoveredPart(null)}
        className={`group flex items-center gap-3 rounded-lg border border-[var(--line)] border-l-4 ${borderStatus} bg-[var(--surface)] p-2.5 text-left shadow-xs transition-shadow hover:shadow-md outline-none`}
        style={{
          boxShadow: isHovered ? '0 0 0 2px var(--accent)' : undefined,
        }}
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg text-white shadow-xs"
          style={{ background: part.color, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {KIND_GLYPHS[part.kind]}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-xs font-bold text-[var(--ink)]">
            {part.name}
          </b>
          <span className="block truncate text-[11px] opacity-75">
            {part.description}
          </span>
          <span
            className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] ${statusBadgeClass}`}
          >
            {statusBadgeText}
          </span>
        </span>
      </motion.button>
    );
  };

  const gridClasses =
    'grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5 xl:grid-cols-1';

  return (
    <aside
      aria-label="Parts tray"
      className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3.5 shadow-sm xl:col-start-2 xl:row-start-1 xl:row-span-4 xl:max-h-[660px] xl:overflow-y-auto"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
          Component Tray
        </h2>
        <span className="font-mono text-xs opacity-75">
          {placedCount}/{requiredParts.length} placed
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--line)]/50">
        <motion.div
          className="h-full bg-[var(--ok)]"
          animate={{ width: `${(placedCount / requiredParts.length) * 100}%` }}
        />
      </div>

      <motion.div key={board.id} className="space-y-3">
        <div className={gridClasses}>{requiredParts.map(renderCard)}</div>
        {mistakeParts.length > 0 && (
          <>
            <h3 className="pt-2 text-[11px] font-bold uppercase tracking-wider text-[var(--bad)]">
              Fault Injection / Mistakes
            </h3>
            <div className={gridClasses}>
              {mistakeParts.map((part, i) =>
                renderCard(part, i + requiredParts.length)
              )}
            </div>
          </>
        )}
      </motion.div>
      <ValueSelectors />
    </aside>
  );
}
