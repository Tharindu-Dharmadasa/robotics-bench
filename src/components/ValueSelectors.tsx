// "Component values": a dropdown for every adjustable part of this board (resistance, LED colour, supply voltage).
// Picking a value updates the store, which re-runs the engine, so the board, the maths and the result change instantly.
import { formatOption } from '../data/parameters';
import { getPartValue } from '../data/parameters';
import { useBenchStore, useCurrentBoard } from '../store/benchStore';

export function ValueSelectors() {
  const { board, boardState } = useCurrentBoard();
  const setPartValue = useBenchStore((store) => store.setPartValue);
  const adjustableParts = board.parts.filter((part) => part.parameter);
  if (adjustableParts.length === 0) return null; // boards without adjustable parts show nothing

  return (
    <section className="mt-3 border-t border-[var(--line)] pt-3">
      <h3 className="mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">Component values</h3>
      {adjustableParts.map((part) => {
        const parameter = part.parameter!;
        const current = getPartValue(board, part.id, boardState.partValues);
        const hasOptions = Boolean(parameter.options && parameter.options.length > 0);
        return (
          <div key={part.id} className="mb-2 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{parameter.label}</span>
              <span className="font-mono text-[11px] opacity-75">{formatOption(parameter.kind, current)}</span>
            </div>
            {hasOptions ? (
              <select
                value={String(current)}
                className="w-full rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-mono text-xs"
                onChange={(event) =>
                  setPartValue(
                    part.id,
                    typeof parameter.defaultValue === "number"
                      ? Number(event.target.value)
                      : event.target.value,
                  )
                }
              >
                {parameter.options!.map((option) => (
                  <option key={String(option)} value={String(option)}>
                    {formatOption(parameter.kind, option)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={parameter.min}
                max={parameter.max}
                step={parameter.step ?? 1}
                value={Number(current)}
                className="w-full rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-mono text-xs"
                onChange={(e) => setPartValue(part.id, Number(e.target.value))}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
