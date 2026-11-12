// A one-line key so the current animation is self-explanatory.
const dot = (color: string) => (
  <span
    className="inline-block h-2.5 w-2.5 rounded-full"
    style={{ background: color }}
  />
);

export function FlowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs opacity-80">
      <span className="flex items-center gap-1.5">
        {dot("#ffe066")} Current flowing (faster = more current)
      </span>
      <span className="flex items-center gap-1.5">
        {dot("#ff4d3d")} Surge: far too much current
      </span>
      <span className="flex items-center gap-1.5">
        <b className="rounded-full bg-[var(--bad)] px-1.5 text-white">✕</b>{" "}
        Break: no current past this point
      </span>
    </div>
  );
}
