import { Fragment, useState } from "react";
import type { RefObject } from "react";
import { Check, Copy } from "lucide-react";

import type { BoardSpec } from "../types/simulator";

interface BottomPanelsProps {
  spec: BoardSpec;
  code: string;
  logs: string[];
  running: boolean;
  usb: boolean;
  logRef: RefObject<HTMLDivElement | null>;
}

export default function BottomPanels({
  spec,
  code,
  logs,
  running,
  usb,
  logRef,
}: BottomPanelsProps) {
  const [copied, setCopied] = useState(false);
  const firstComment = code.split("\n")[0] ?? "";
  const sketchTitle =
    firstComment.replace(/^\/\/\s*/, "").split(/[—:]/)[0].trim() || "SKETCH";

  return (
    <div className="grid h-60 shrink-0 grid-cols-3 border-t border-[#222]">
      <div className="overflow-y-auto border-r border-[#222] p-4 text-xs leading-relaxed">
        <div className="mb-2 text-[10px] tracking-widest text-[#666]">
          ABOUT THE BOARD
        </div>
        {spec.description.length > 0 ? (
          <p>
            {spec.description.map((segment, i) =>
              segment.bold ? (
                <b key={i}>{segment.text}</b>
              ) : (
                <Fragment key={i}>{segment.text}</Fragment>
              ),
            )}
          </p>
        ) : (
          <p>
            <b>{spec.name}</b> — {spec.subtitle}. This lab is on the bench as a
            preview; build Fig. 01 end-to-end first.
          </p>
        )}
      </div>
      <div className="flex min-h-0 flex-col border-r border-[#222] p-4">
        <div className="mb-2 flex items-center justify-between text-[10px] tracking-widest text-[#666]">
          TRY IT YOURSELF · {sketchTitle.toUpperCase()}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="flex items-center gap-1 rounded-full border border-[#222] px-2 py-0.5 text-[10px] text-[#222] hover:bg-[#222] hover:text-[#EAE6DF]"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}{" "}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="flex-1 overflow-auto rounded-lg border border-[#222] bg-[#f7f4ee] p-2 text-[11px] leading-snug">
          {code}
        </pre>
      </div>
      <div className="flex min-h-0 flex-col p-4">
        <div className="mb-2 flex items-center justify-between text-[10px] tracking-widest text-[#666]">
          SERIAL MONITOR · 9600 BAUD
          <span
            className={`h-2 w-2 rounded-full ${running ? "bg-green-600" : usb ? "bg-amber-500" : "bg-[#999]"}`}
          />
        </div>
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto rounded-lg border border-[#222] bg-[#1c1c1a] p-2 text-[11px] leading-snug text-[#9fe39f]"
        >
          {logs.map((l, i) => (
            <div key={i} className={l.startsWith("!") ? "text-[#ff9a7a]" : ""}>
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
