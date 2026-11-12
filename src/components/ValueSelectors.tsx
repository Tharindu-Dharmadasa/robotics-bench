// "Component values": a dropdown for every adjustable part of this board (resistance, LED colour, supply voltage).
// Picking a value updates the store, which re-runs the engine, so the board, the maths and the result change instantly.
import {formatOption} from '../data/parameters';
import {getPartValue} from '../data/parameters';
import {useBenchStore, useCurrentBoard} from '../store/benchStore';

export function ValueSelectors() {
  const {board, boardState} = useCurrentBoard();
  const setPartValue = useBenchStore((store) => store.setPartValue);
  const adjustableParts = board.parts.filter((part) => part.parameter);
  if (adjustableParts.length === 0) return null; // boards without adjustable parts show nothing

  return (
    <section className="mt-3 border-t border-[var(--line)] pt-3">
      <h3 className="mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">Component values</h3>
      {adjustableParts.map((part) => {
        const parameter = part.parameter!;
        const current = getPartValue(board, part.id, boardState.partValues);
        return (
          <label key={part.id} className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span>{parameter.label}</span>
            <select value={String(current)} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1"
              // Resistances and voltages are numbers; LED colours are text keys.
              onChange={(event) => setPartValue(part.id, typeof parameter.defaultValue === 'number' ? Number(event.target.value) : event.target.value)}>
              {parameter.options.map((option) => <option key={String(option)} value={String(option)}>{formatOption(parameter.kind, option)}</option>)}
            </select>
          </label>
        );
      })}
    </section>
  );
}
