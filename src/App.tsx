import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Power,
  Usb,
  Layers,
  Cpu,
  Eraser,
  Flame,
  Zap,
  Wrench,
} from "lucide-react";

import BottomPanels from "./components/BottomPanels";
import ControlColumn, { type BenchAction } from "./components/ControlColumn";
import Sidebar from "./components/Sidebar";
import Viewport3D from "./components/Viewport3D";
import { BOARD_SPECS } from "./data/boards";
import type { BoardSpec, FaultRule, SimStatus } from "./types/simulator";

/**
 * ~60% of a board's parts arrive pre-placed so every lab renders immediately.
 * Parts the faultRule marks as critical start unplaced, so the
 * "power on without the resistor" fault demo works out of the box.
 */
const initialPlaced = (spec: BoardSpec) => {
  const critical = new Set(spec.faultRule?.criticalParts ?? []);
  const pool = spec.parts.filter((p) => !critical.has(p.id));
  const wanted = Math.max(1, Math.round(spec.parts.length * 0.6));
  return new Set(pool.slice(0, Math.min(wanted, pool.length)).map((p) => p.id));
};

export default function App() {
  const [board, setBoard] = useState(0);
  const [placed, setPlaced] = useState<Set<string>>(() =>
    initialPlaced(BOARD_SPECS[0]),
  );
  const [soldered, setSoldered] = useState(false);
  const [usb, setUsb] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [running, setRunning] = useState(false);
  const [color, setColor] = useState("Blue");
  const [labels, setLabels] = useState(true);
  const [fault, setFault] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "> Bench ready. Place the remaining parts.",
  ]);
  const [hover, setHover] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  const [flick, setFlick] = useState(false);
  const [explode, setExplode] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const activeBoard = BOARD_SPECS[board];
  const parts = activeBoard.parts;
  const total = parts.length;
  const criticalParts = activeBoard.faultRule?.criticalParts ?? [];

  const log = (s: string) => setLogs((l) => [...l.slice(-80), s]);
  const count = placed.size;
  const powered = usb && soldered && count === total && fault === null;
  const status: SimStatus = fault
    ? "FAULT"
    : running
      ? "RUNNING"
      : count === 0
        ? "BARE PCB"
        : count < total
          ? "ASSEMBLING"
          : !soldered
            ? "NEEDS SOLDER"
            : "READY";

  /** Loads ANY board (index 0-12): parts, description, code and faultRule all come from the spec. */
  const selectBoard = (index: number) => {
    const spec = BOARD_SPECS[index];
    if (!spec) return;
    setBoard(index);
    setPlaced(initialPlaced(spec));
    setSoldered(false);
    setUsb(false);
    setExploded(false);
    setRunning(false);
    setFault(null);
    setBlink(false);
    setFlick(false);
    setHover(null);
    setLogs([
      `> Fig. ${String(index + 1).padStart(2, "0")} — ${spec.name} loaded. Place the remaining parts.`,
    ]);
  };

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setExplode((e) => {
        const t = exploded ? 1 : 0;
        return Math.abs(t - e) < 0.002 ? t : e + (t - e) * 0.1;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [exploded]);

  useEffect(() => {
    if (!running) {
      setBlink(false);
      return;
    }
    let on = false;
    let ms = 0;
    const id = setInterval(() => {
      on = !on;
      ms += 500;
      setBlink(on);
      setFlick(true);
      setTimeout(() => setFlick(false), 80);
      log(
        `[${(ms / 1000).toFixed(1).padStart(5, " ")}s] ${on ? "LED ON" : "LED OFF"}`,
      );
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  const stopIfBroken = () => {
    if (running) {
      setRunning(false);
      log("! Power lost — board halted.");
    }
  };

  const triggerFault = (rule: FaultRule) => {
    setRunning(false);
    setBlink(false);
    setFault(rule.errorMessage);
    log(`> ${rule.label}: ${rule.cause}`);
    log(`! ERROR: ${rule.errorMessage}`);
  };

  /** Toggle a single part on/off from the COMPONENTS checklist. */
  const togglePart = (id: string) => {
    const part = parts.find((p) => p.id === id);
    if (!part) return;
    const rule = activeBoard.faultRule;

    if (placed.has(id)) {
      setPlaced((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setSoldered(false);
      log(`> Removed ${part.name}.`);
      if (running) {
        if (rule && rule.criticalParts?.includes(id)) triggerFault(rule);
        else stopIfBroken();
      }
    } else {
      setPlaced((s) => new Set([...s, id]));
      if (!part.smd) setSoldered(false);
      log(`> Placed ${part.name}.`);
    }
  };

  const actions: BenchAction[] = [
    {
      label: "Strip to bare PCB",
      icon: Eraser,
      fn: () => {
        setPlaced(new Set());
        setSoldered(false);
        setFault(null);
        setRunning(false);
        setBlink(false);
        log("> Stripped down to bare FR-4 PCB. Fault state cleared.");
      },
    },
    {
      label: "Pick & place SMD",
      icon: Cpu,
      fn: () => {
        setPlaced(
          (s) =>
            new Set([...s, ...parts.filter((p) => p.smd).map((p) => p.id)]),
        );
        log(
          `> Pick & place: ${parts.filter((p) => p.smd).length} SMD parts reflowed.`,
        );
      },
    },
    {
      label: "Place a part",
      icon: Plus,
      fn: () => {
        const nextSmd = parts.find((p) => p.smd && !placed.has(p.id));
        const next = parts.find((p) => !placed.has(p.id));
        const pick = nextSmd || next;
        if (!pick) return log(`> All ${total} parts already placed.`);
        setPlaced((s) => new Set([...s, pick.id]));
        if (!pick.smd) setSoldered(false);
        log(`> Placed ${pick.name}.`);
      },
    },
    {
      label: "Solder joints",
      icon: Flame,
      fn: () => {
        if (count < total) return log("! Place all parts before soldering.");
        setSoldered(true);
        log("> Solder joints flowed. Shiny & conical. ✓");
      },
    },
    {
      label: "Plug / unplug USB",
      icon: Usb,
      fn: () => {
        const n = !usb;
        setUsb(n);
        if (!n) stopIfBroken();
        log(
          n ? "> USB connected — /dev/ttyACM0 @ 9600" : "> USB disconnected.",
        );
      },
    },
    { label: "Exploded view", icon: Layers, fn: () => setExploded((e) => !e) },
    {
      label: running ? "Stop" : "Power on / Run",
      icon: Power,
      fn: () => {
        if (running) {
          setRunning(false);
          return log("> Sketch halted.");
        }
        if (fault) return log("! Fault active — repair before running.");

        // Missing critical part (e.g. LED without its resistor) => board faults on power-on.
        const rule = activeBoard.faultRule;
        const missingCritical =
          rule?.criticalParts?.filter((cid) => !placed.has(cid)) ?? [];
        if (rule && missingCritical.length > 0) return triggerFault(rule);

        if (count < total) return log(`! Missing ${total - count} parts.`);
        if (!soldered) return log("! Cold joints — solder the board first.");
        if (!usb) return log("! No power — plug in USB.");
        log(`> avrdude: uploading ${activeBoard.name} sketch ... done.`);
        setRunning(true);
      },
    },
    {
      label: "Break / Fault Test",
      icon: Zap,
      fn: () => {
        const rule = activeBoard.faultRule;
        if (!rule) return log("! No fault routine defined for this board.");
        if (fault) return log("! Fault already active — repair / reset first.");
        triggerFault(rule);
      },
    },
    {
      label: "Repair / Reset Fault",
      icon: Wrench,
      fn: () => {
        if (!fault) return log("> No active fault to repair.");
        setFault(null);
        const stillMissing = criticalParts.filter((cid) => !placed.has(cid));
        log("> Fault cleared — board repaired and ready.");
        if (stillMissing.length > 0)
          log(
            `> Note: ${stillMissing.length} critical part(s) are still missing — add them before powering on.`,
          );
      },
    },
  ];

  const litMap = (id: string) => {
    const part = parts.find((p) => p.id === id);
    if (!part) return false;
    if (part.kind === "servo" || part.kind === "oled")
      return powered && running;
    if (!powered) return false;
    if (id === "ledon") return true;
    if (!running) return false;
    if (id === "ledl") return blink;
    if (id === "ledtx") return flick;
    if (id === "ledrx") return false;
    return false;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#EAE6DF] font-mono text-[#222]">
      <Sidebar board={board} onSelect={selectBoard} />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <ControlColumn
            fig={board + 1}
            title={activeBoard.name}
            actions={actions}
            color={color}
            onColorChange={setColor}
            labels={labels}
            onToggleLabels={() => setLabels((l) => !l)}
            exploded={exploded}
            usb={usb}
            fault={fault}
            parts={parts}
            placed={placed}
            criticalParts={criticalParts}
            onTogglePart={togglePart}
            onHoverPart={setHover}
          />

          <Viewport3D
            spec={activeBoard}
            parts={parts}
            placed={placed}
            soldered={soldered}
            usb={usb}
            explode={explode}
            color={color}
            litMap={litMap}
            count={count}
            total={total}
            status={status}
            fault={fault}
            hover={hover}
            onHover={setHover}
            onGlbFallback={() =>
              log("> No usable .glb model — procedural scene engaged.")
            }
          />
        </div>

        <BottomPanels
          spec={activeBoard}
          code={activeBoard.code}
          logs={logs}
          running={running}
          usb={usb}
          logRef={logRef}
        />
      </main>
    </div>
  );
}
