import { Fragment } from "react";
import { Check, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { COLORS } from "../data/boards";
import type { Part } from "../types/simulator";
import LabInstrumentPanel from "./LabInstrumentPanel";
import type { EduFault } from "./Viewport3D";

export interface BenchAction {
  label: string;
  icon: LucideIcon;
  fn: () => void;
}

/** Bench view: interactive procedural parts, or the real CAD (.glb) model. */
export type ViewMode = "parts" | "cad";

interface ControlColumnProps {
  fig: number;
  title: string;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  /** Whether a .glb model exists for the active board (enables the CAD toggle). */
  glbAvailable: boolean;
  actions: BenchAction[];
  color: string;
  onColorChange: (color: string) => void;
  labels: boolean;
  onToggleLabels: () => void;
  exploded: boolean;
  usb: boolean;
  faultActive: boolean;
  /** Parts of the active board, shown in the BOARD PARTS list. */
  parts: Part[];
  placed: Set<string>;
  /** Part ids the board's faultRule requires (marked "req" in the list). */
  criticalParts?: string[];
  /** Currently configured value per part id (for parts with valueOptions). */
  values: Record<string, string>;
  onTogglePart: (id: string) => void;
  onValueChange: (id: string, value: string) => void;
  onHoverPart?: (label: string | null) => void;
  /** Zero-based active board index (drives the lab instrument panel, 0-4). */
  boardIndex: number;
  /** Sketch state for the live D13 probe readout. */
  running: boolean;
  blink: boolean;
  /** Sonar target distance in cm, lifted to App so Viewport3D can use it too. */
  targetDistance: number;
  onTargetDistance: (cm: number) => void;
  /** Fig. 03 · lifted D9 pin state + toggle (energize logic lives in App). */
  d9High: boolean;
  onD9Toggle: (next: boolean) => void;
  /** Fig. 03 · fire the HIGH→LOW flyback burnout check (logic lives in App). */
  onTriggerBurnout: () => void;
  /** Fig. 09–11 · bench instrument state + setters (lifted to App). */
  imuTilt?: { pitch: number; roll: number };
  onImuTiltChange?: (tilt: { pitch: number; roll: number }) => void;
  onImuReset?: () => void;
  encoderStep?: number;
  encoderPressed?: boolean;
  onEncoderRotate?: (dir: 1 | -1) => void;
  onEncoderSetPressed?: (pressed: boolean) => void;
  pcaAngle?: number;
  onPcaAngleChange?: (deg: number) => void;
  /** 3D jumper-wire / current-flow overlay visibility. */
  showWires: boolean;
  onToggleWires: () => void;
  /** Structured fault raised by an instrument interaction. */
  onInstrumentFault: (fault: EduFault) => void;
  /** Serial monitor line from an instrument interaction. */
  onInstrumentLog: (line: string) => void;
}

export default function ControlColumn({
  fig,
  title,
  viewMode,
  onViewMode,
  glbAvailable,
  actions,
  color,
  onColorChange,
  labels,
  onToggleLabels,
  exploded,
  usb,
  faultActive,
  parts,
  placed,
  criticalParts = [],
  values,
  onTogglePart,
  onValueChange,
  onHoverPart,
  boardIndex,
  running,
  blink,
  targetDistance,
  onTargetDistance,
  d9High,
  onD9Toggle,
  onTriggerBurnout,
  imuTilt,
  onImuTiltChange,
  onImuReset,
  encoderStep,
  encoderPressed,
  onEncoderRotate,
  onEncoderSetPressed,
  pcaAngle,
  onPcaAngleChange,
  showWires,
  onToggleWires,
  onInstrumentFault,
  onInstrumentLog,
}: ControlColumnProps) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#222] p-4">
      <h2 className="text-sm font-bold">
        Fig. {String(fig).padStart(2, "0")} — {title}
      </h2>

      {/* Retro lab instrument module for the active board (0-4) */}
      <LabInstrumentPanel
        boardIndex={boardIndex}
        parts={parts}
        placed={placed}
        values={values}
        running={running}
        blink={blink}
        targetDistance={targetDistance}
        onTargetDistance={onTargetDistance}
        d9High={d9High}
        onD9Toggle={onD9Toggle}
        onTriggerBurnout={onTriggerBurnout}
        imuTilt={imuTilt}
        onImuTiltChange={onImuTiltChange}
        onImuReset={onImuReset}
        encoderStep={encoderStep}
        encoderPressed={encoderPressed}
        onEncoderRotate={onEncoderRotate}
        onEncoderSetPressed={onEncoderSetPressed}
        pcaAngle={pcaAngle}
        onPcaAngleChange={onPcaAngleChange}
        onFault={onInstrumentFault}
        onLog={onInstrumentLog}
      />

      {/* Hybrid view toggle: procedural bench vs real CAD model */}
      <div className="flex rounded-full border border-[#222] bg-[#f3efe7] p-0.5 text-[10px] font-bold">
        <button
          onClick={() => onViewMode("parts")}
          className={`flex-1 rounded-full px-2 py-1 transition ${
            viewMode === "parts"
              ? "bg-[#222] text-[#EAE6DF]"
              : "text-[#666] hover:text-[#222]"
          }`}
        >
          Interactive Parts
        </button>
        <button
          onClick={() => glbAvailable && onViewMode("cad")}
          disabled={!glbAvailable}
          title={
            glbAvailable
              ? "Show the real CAD (.glb) model"
              : "No .glb model for this board"
          }
          className={`flex-1 rounded-full px-2 py-1 transition ${
            viewMode === "cad"
              ? "bg-[#222] text-[#EAE6DF]"
              : glbAvailable
                ? "text-[#666] hover:text-[#222]"
                : "cursor-not-allowed text-[#bbb]"
          }`}
        >
          Real CAD (.glb)
        </button>
      </div>

      <div className="text-[10px] tracking-widest text-[#666]">BENCH</div>
      {actions.map((a) => {
        const isFaultBtn = a.label === "Break / Fault Test";
        const active =
          a.label === "Stop" ||
          (a.label === "Exploded view" && exploded) ||
          (a.label.startsWith("Plug") && usb) ||
          (a.label === "Repair / Reset Fault" && faultActive);
        return (
          <Fragment key={a.label}>
            <button
              onClick={a.fn}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition ${
                isFaultBtn
                  ? "border-red-800 bg-[#f3efe7] text-red-800 hover:bg-red-800 hover:text-[#EAE6DF]"
                  : "border-[#222] hover:bg-[#222] hover:text-[#EAE6DF]"
              } ${active ? "bg-[#222] text-[#EAE6DF]" : isFaultBtn ? "" : "bg-[#f3efe7]"}`}
            >
              <a.icon size={13} /> {a.label}
            </button>

            {/* BOARD PARTS list sits directly under "Place a part" */}
            {a.label === "Place a part" && (
              <div className="mt-1">
                <div className="flex items-center justify-between text-[10px] tracking-widest text-[#666]">
                  <span>BOARD PARTS</span>
                  <span>
                    {placed.size}/{parts.length}
                  </span>
                </div>
                <div
                  className="flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-lg border border-[#222] bg-[#f3efe7] p-1.5"
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
                    const cur = values[p.id] ?? p.value ?? "";
                    return (
                      <div key={p.id} className="flex items-center gap-1">
                        <button
                          onClick={() => onTogglePart(p.id)}
                          onMouseEnter={() => onHoverPart?.(p.label ?? p.name)}
                          onMouseLeave={() => onHoverPart?.(null)}
                          title={
                            on ? `Remove ${p.name}` : `Place ${p.name}`
                          }
                          className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[10px] leading-tight transition hover:bg-[#e2ddd1] ${
                            on ? "text-[#222]" : "text-[#888]"
                          }`}
                        >
                          <span
                            className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border border-[#222] ${
                              on ? "bg-[#222] text-[#EAE6DF]" : "bg-transparent"
                            }`}
                          >
                            {on && <Check size={9} strokeWidth={3} />}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate ${on ? "" : "line-through decoration-[#aaa]"}`}
                          >
                            {p.name}
                          </span>
                          <span className="shrink-0 rounded-sm border border-[#999] px-0.5 text-[7px] uppercase text-[#666]">
                            {p.smd ? "smd" : "tht"}
                          </span>
                          {critical && (
                            <span className="shrink-0 rounded-sm border border-red-800 px-0.5 text-[7px] uppercase text-red-800">
                              req
                            </span>
                          )}
                        </button>
                        {p.valueOptions && (
                          <select
                            value={cur || p.valueOptions[0]}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onValueChange(p.id, e.target.value)}
                            onMouseEnter={() =>
                              onHoverPart?.(`${p.name} · change value`)
                            }
                            onMouseLeave={() => onHoverPart?.(null)}
                            title={`Change ${p.name} value`}
                            className="w-16 shrink-0 cursor-pointer rounded border border-[#222] bg-[#EAE6DF] px-0.5 text-[8px] leading-tight"
                          >
                            {p.valueOptions.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Fragment>
        );
      })}

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
      <div className="mt-3 text-[10px] tracking-widest text-[#666]">
        3D WIRES
      </div>
      <button
        onClick={onToggleWires}
        title="Show arched 3D jumper wires + directional current arrows"
        className={`w-16 rounded-full border border-[#222] px-3 py-1 text-xs ${showWires ? "bg-[#222] text-[#EAE6DF]" : ""}`}
      >
        {showWires ? "On" : "Off"}
      </button>
      <div className="mt-auto pt-4 text-[10px] leading-snug text-[#666]">
        <Wrench size={11} className="inline" /> Drag to orbit · scroll to zoom ·
        click a placed part to remove it
      </div>
    </div>
  );
}
