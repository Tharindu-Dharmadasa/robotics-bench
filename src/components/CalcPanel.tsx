// "Live calculation": the working behind the result (Ohm's law etc.), taken from result.details.
import {useCurrentBoard} from '../store/benchStore';

export function CalcPanel() {
  const {boardState} = useCurrentBoard();
  const details = boardState.lastResult?.details;
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="mb-1 text-xs uppercase tracking-widest text-[var(--accent)]">Live calculation</h3>
      {details?.length ? (
        <ul className="space-y-1 font-mono text-xs">{details.map((line) => <li key={line}>{line}</li>)}</ul>
      ) : (
        <p className="text-sm opacity-70">Power the board to see the maths behind the result. Then change a component value and watch it update.</p>
      )}
    </section>
  );
}
