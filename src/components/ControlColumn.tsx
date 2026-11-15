import { Check, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { COLORS } from "../data/boards";
import type { Part } from "../types/simulator";

export interface BenchAction {
  label: string;
  icon: LucideIcon;
  fn: () => void;
}

interface ControlColumnProps {
  fig: number;
  title: string;
  actions: BenchAction[];
  color: string;
  onColorChange: (color: string) => void;
  labels: boolean;
  onToggleLabels: () => void;
  exploded: boolean;
  usb: boolean;
  fault: string | null;
  /** Parts of the active board, shown in the COMPONENTS checklist. */
  parts: Part[];
  placed: Set<string>;
  /** Part ids the board's faultRule requires (marked "req" in the list). */
  criticalParts?: string[];
  onTogglePart: (id: string) => void;
  onHoverPart?: (label: string | null) => void;
}

export default function ControlColumn({
  fig,
  title,
  actions,
  color,
  onColorChange,
  labels,
  onToggleLabels,
  exploded,
  usb,
  fault,
  parts,
  placed,
  criticalParts = [],
  onTogglePart,
  onHoverPart,
}: ControlColumnProps) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#222] p-4">
      <h2 className="text-sm font-bold">
        Fig. {String(fig).padStart(2, "0")} — {title}
      </h2>
      <div className="text-[10px] tracking-widest text-[#666]">BENCH</div>
      {actions.map((a) => {
        const isFaultBtn = a.label === "Break / Fault Test";
        const active =
          a.label === "Stop" ||
          (a.label === "Exploded view" && exploded) ||
          (a.label.startsWith("Plug") && usb) ||
          (a.label === "Repair / Reset Fault" && fault !== null);
        return (
          <button
            key={a.label}
            onClick={a.fn}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition ${
              isFaultBtn
                ? "border-red-800 bg-[#f3efe7] text-red-800 hover:bg-red-800 hover:text-[#EAE6DF]"
                : "border-[#222] hover:bg-[#222] hover:text-[#EAE6DF]"
            } ${active ? "bg-[#222] text-[#EAE6DF]" : isFaultBtn ? "" : "bg-[#f3efe7]"}`}
          >
            <a.icon size={13} /> {a.label}
          </button>
        );
      })}

      <div className="mt-3 flex items-center justify-between text-[10px] tracking-widest text-[#666]">
        <span>COMPONENTS</span>
        <span>
          {placed.size}/{parts.length}
        </span>
      </div>
      <div
        className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-[#222] bg-[#f3efe7] p-1.5"
        onMouseLeave={() => onHoverPart?.(null)}
      >
        {parts.length === 0 && (
          <div className="px-1 py-1 text-[10px] text-[#666]">
            No parts on this board.
          </div>
        )}
        {parts.map((p) => {
          const on = placed.has(p.id);
          const critical = criticalParts.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onTogglePart(p.id)}
              onMouseEnter={() => onHoverPart?.(p.label ?? p.name)}
              title={on ? `Remove ${p.name}` : `Place ${p.name}`}
              className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition hover:bg-[#e2ddd1] ${
                on ? "text-[#222]" : "text-[#888]"
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-[#222] ${
                  on ? "bg-[#222] text-[#EAE6DF]" : "bg-transparent"
                }`}
              >
                {on && <Check size={10} strokeWidth={3} />}
              </span>
              <span
                className={`min-w-0 flex-1 truncate ${on ? "" : "line-through decoration-[#aaa]"}`}
              >
                {p.name}
              </span>
              {critical && (
                <span className="shrink-0 rounded-sm border border-red-800 px-1 text-[8px] uppercase text-red-800">
                  req
                </span>
              )}
              {p.smd && (
                <span className="shrink-0 text-[8px] uppercase text-[#666]">
                  smd
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] tracking-widest text-[#666]">
        PCB COLOUR
      </div>
      <div className="flex gap-2">
        {Object.entries(COLORS).map(([k, v]) => (
          <button
            key={k}
            title={k}
            onClick={() => onColorChange(k)}
            style={{ background: v }}
            className={`h-6 w-6 rounded-full border border-[#222] ${color === k ? "ring-2 ring-[#222] ring-offset-2 ring-offset-[#EAE6DF]" : ""}`}
          />
        ))}
      </div>
      <div className="mt-3 text-[10px] tracking-widest text-[#666]">LABELS</div>
      <button
        onClick={onToggleLabels}
        className={`w-16 rounded-full border border-[#222] px-3 py-1 text-xs ${labels ? "bg-[#222] text-[#EAE6DF]" : ""}`}
      >
        {labels ? "On" : "Off"}
      </button>
      <div className="mt-auto pt-4 text-[10px] leading-snug text-[#666]">
        <Wrench size={11} className="inline" /> Drag to orbit · scroll to zoom
      </div>
    </div>
  );
}
