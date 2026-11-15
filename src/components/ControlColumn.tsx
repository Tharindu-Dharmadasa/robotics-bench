import { Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { COLORS } from "../data/boards";

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
}: ControlColumnProps) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#222] p-4">
      <h2 className="text-sm font-bold">
        Fig. {String(fig).padStart(2, "0")} — {title}
      </h2>
      <div className="text-[10px] tracking-widest text-[#666]">BENCH</div>
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.fn}
          className={`flex items-center gap-2 rounded-full border border-[#222] px-3 py-1.5 text-left text-xs transition hover:bg-[#222] hover:text-[#EAE6DF] ${a.label === "Stop" || (a.label === "Exploded view" && exploded) || (a.label.startsWith("Plug") && usb) ? "bg-[#222] text-[#EAE6DF]" : "bg-[#f3efe7]"}`}
        >
          <a.icon size={13} /> {a.label}
        </button>
      ))}
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
      <div className="mt-3 text-[10px] tracking-widest text-[#666]">
        LABELS
      </div>
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
