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
import ControlColumn, { type BenchAction, type ViewMode } from "./components/ControlColumn";
import Sidebar from "./components/Sidebar";
import Viewport3D, { type EduFault } from "./components/Viewport3D";
import { BOARD_SPECS } from "./data/boards";
import type { BoardSpec, FaultRule, Part, PartEffect, SimStatus } from "./types/simulator";

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

/** Every part starts at its printed/nominal value (the safe configuration). */
const initialValues = (spec: BoardSpec) =>
  Object.fromEntries(
    spec.parts.filter((p) => p.value).map((p) => [p.id, p.value!]),
  );

/**
 * Board-specific serial telemetry for one 500 ms tick of the running sketch:
 * Fig. 02 prints LED current (value-aware), Fig. 03 the relay switch state,
 * Fig. 04 WiFi/RGB activity, Fig. 05 echo ranging. Any other board keeps the
 * classic Blink heartbeat.
 */
function boardTelemetry(
  boardId: number,
  on: boolean,
  ms: number,
  values: Record<string, string>,
): string {
  const ts = `[${(ms / 1000).toFixed(1).padStart(5, " ")}s]`;
  switch (boardId) {
    case 2: {
      if (!on) return `${ts} LED OFF · I = 0 mA`;
      const r = (values["r1"] ?? "").toLowerCase();
      if (r.includes("10k")) return `${ts} LED ON · I = 0.3 mA (Dim)`;
      if (r.startsWith("10")) return `${ts} LED ON · I = 300 mA (OVERCURRENT)`;
      return `${ts} LED ON · I = 14.5 mA (220Ω)`;
    }
    case 3:
      return on
        ? `${ts} D9 HIGH → 2N2222 SATURATED → Relay Load ON (12V)`
        : `${ts} Relay OFF`;
    case 4:
      return `${ts} Core ${Math.round(ms / 500) % 2}/1: WiFi RSSI ${
        -52 - Math.round(Math.random() * 8)
      } dBm · GPIO48 RGB Pulse`;
    case 5: {
      const echo = Math.round(500 + Math.random() * 14000);
      return `${ts} HC-SR04 Ping: Echo ${echo} µs → Distance: ${(echo / 58).toFixed(1)} cm`;
    }
    default:
      return `${ts} ${on ? "LED ON" : "LED OFF"}`;
  }
}

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
  const [fault, setFault] = useState<EduFault | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("parts");
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(BOARD_SPECS[0]),
  );
  const [glbAvailable, setGlbAvailable] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "> Bench ready. Place the remaining parts.",
  ]);
  const [hover, setHover] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  const [flick, setFlick] = useState(false);
  const [explode, setExplode] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  // live mirror of `values` for the telemetry interval (no timer restarts)
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const activeBoard = BOARD_SPECS[board];
  const parts = activeBoard.parts;
  const total = parts.length;
  const criticalParts = activeBoard.faultRule?.criticalParts ?? [];

  const log = (s: string) => setLogs((l) => [...l.slice(-80), s]);
  const count = placed.size;
  const powered =
    usb && soldered && count === total && (!fault || fault.severity === "degraded");
  const status: SimStatus = fault && fault.severity !== "degraded"
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
    setValues(initialValues(spec));
    setLogs([
      `> Fig. ${String(index + 1).padStart(2, "0")} — ${spec.name} loaded. Place the remaining parts.`,
    ]);
  };

  // Is there a real CAD model for this board? (drives the "Real CAD" toggle)
  useEffect(() => {
    let alive = true;
    setGlbAvailable(false);
    const url = `/models/fig-${String(activeBoard.id).padStart(2, "0")}.glb`;
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (
          alive &&
          res.ok &&
          !(res.headers.get("content-type") ?? "").includes("text/html")
        )
          setGlbAvailable(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activeBoard.id]);

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
    // values are read through a ref inside the tick, so changing a resistor
    // mid-run doesn't restart the blink cycle — it just changes what the next
    // telemetry line prints.
    let on = false;
    let ms = 0;
    const id = setInterval(() => {
      on = !on;
      ms += 500;
      setBlink(on);
      setFlick(true);
      setTimeout(() => setFlick(false), 80);
      log(boardTelemetry(activeBoard.id, on, ms, valuesRef.current));
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, activeBoard.id]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  const stopIfBroken = () => {
    if (running) {
      setRunning(false);
      log("! Power lost — board halted.");
    }
  };

  /**
   * Classic per-board fault routine (faultRule): something critical is missing
   * or broken, so the board's signature fault fires.
   */
  const triggerFault = (rule: FaultRule) => {
    setRunning(false);
    setBlink(false);
    const burn = parts.find((p) => p.id === rule.criticalPart);
    setFault({
      partId: rule.criticalPart,
      partName: burn?.name ?? rule.label,
      severity: burn && placed.has(burn.id) ? "burnout" : "halt",
      message: `${rule.cause} ${rule.effect}`,
      burnPartId: rule.criticalPart,
    });
    log(`> ${rule.label}: ${rule.cause}`);
    log(`! ERROR: ${rule.errorMessage}`);
  };

  /**
   * Data-driven consequence (PartEffect) from removing a part or setting an
   * unsafe value while the board is powered. The banner shows the damaged
   * component when the effect names one, otherwise the culprit itself.
   */
  const raiseEffect = (
    part: Part,
    eff: PartEffect,
    opts: { keepRunning?: boolean } = {},
  ) => {
    // A degraded consequence (e.g. 10kΩ starved LED) keeps the sketch running
    // — the board still works, just badly; burnout/halt shut it down.
    const keep = !!opts.keepRunning && eff.severity === "degraded";
    if (!keep) {
      setRunning(false);
      setBlink(false);
    }
    const burnId =
      eff.severity === "burnout"
        ? (eff.damagedPartId ?? part.id)
        : eff.damagedPartId;
    const burn = parts.find((p) => p.id === burnId);
    setFault({
      partId: part.id,
      partName: burn?.name ?? part.name,
      severity: eff.severity,
      message: eff.message,
      burnPartId: burnId,
    });
    log(`! ERROR: ${eff.message}`);
  };

  /** Change a part's configured value (e.g. 1kΩ → 10Ω) from the parts list. */
  const changeValue = (id: string, opt: string) => {
    const part = parts.find((p) => p.id === id);
    if (!part || !part.valueOptions?.includes(opt)) return;
    setValues((v) => ({ ...v, [id]: opt }));
    log(`> ${part.name} set to ${opt}.`);
    const eff = part.valueEffects?.[opt];
    if (!eff) return;
    if (usb && soldered && placed.has(id) && !fault)
      raiseEffect(part, eff, { keepRunning: true });
    else
      log(
        `> Power the assembled board to see what ${opt} does to this circuit.`,
      );
  };

  /** Quick-fix from the HUD fault banner (and the Repair bench action). */
  const repairFault = () => {
    if (!fault) return log("> No active fault to repair.");
    setFault(null);
    const ids = [
      fault.partId,
      ...(fault.burnPartId ? [fault.burnPartId] : []),
    ];
    ids.forEach((id) => {
      const p = parts.find((x) => x.id === id);
      if (p && !placed.has(id)) {
        setPlaced((s) => new Set([...s, id]));
        if (!p.smd) setSoldered(false);
        log(`> Replaced ${p.name}.`);
      }
      const safe =
        p?.valueOptions?.find((o) => /safe/i.test(o)) ?? p?.valueOptions?.[0];
      if (p?.valueOptions && safe && values[id] !== safe) {
        setValues((v) => ({ ...v, [id]: safe }));
        log(`> ${p.name} restored to ${safe}.`);
      }
    });
    log("> Fault cleared — board repaired and ready.");
  };

  /** Toggle a single part on/off from the COMPONENTS checklist (or 3D click). */
  const togglePart = (id: string) => {
    const part = parts.find((p) => p.id === id);
    if (!part) return;
    const rule = activeBoard.faultRule;
    // Electrically powered = soldered + USB in + no active (non-degraded) fault.
    const wasPowered =
      usb && soldered && (!fault || fault.severity === "degraded");

    if (placed.has(id)) {
      setPlaced((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setSoldered(false);
      log(`> Removed ${part.name}.`);
      if (wasPowered) {
        if (part.onRemoveEffect) return raiseEffect(part, part.onRemoveEffect);
        if (rule && rule.criticalParts?.includes(id)) return triggerFault(rule);
        stopIfBroken();
        setFault({
          partId: id,
          partName: part.name,
          severity: "degraded",
          message: `CIRCUIT OPEN: the ${part.name} was pulled while the board was powered. Whatever current path flows through it is now broken, so everything downstream of it stops working until the part goes back in.`,
        });
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

        if (count < total) {
          const missing = parts.filter((p) => !placed.has(p.id));
          log(`! Missing ${total - count} parts.`);
          setFault({
            partId: missing[0].id,
            partName: missing[0].name,
            severity: "halt",
            message: `POWER-ON REFUSED: the board is incomplete — ${total - count} part(s) still missing, starting with the ${missing[0].name}. A PCB only becomes a circuit when every part is placed and soldered; until then there is nothing to power up.`,
          });
          return;
        }
        if (!soldered) return log("! Cold joints — solder the board first.");
        if (!usb) return log("! No power — plug in USB.");

        // An unsafe value was configured earlier? The board powers straight
        // into that consequence (e.g. 10Ω LED resistor → burnout).
        const unsafe = parts.find((p) => {
          if (!placed.has(p.id) || !p.valueEffects) return false;
          const cur = values[p.id] ?? p.value;
          return !!cur && !!p.valueEffects[cur];
        });
        if (unsafe) {
          const cur = values[unsafe.id] ?? unsafe.value!;
          const eff = unsafe.valueEffects![cur];
          const keep = eff.severity === "degraded";
          raiseEffect(unsafe, eff, { keepRunning: true });
          if (keep) {
            log(`> avrdude: uploading ${activeBoard.name} sketch ... done.`);
            setRunning(true);
          }
          return;
        }

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
      fn: repairFault,
    },
  ];

  const litMap = (id: string) => {
    const part = parts.find((p) => p.id === id);
    if (!part) return false;
    if (part.kind === "servo" || part.kind === "oled")
      return powered && running;
    if (!powered) return false;
    // board-specific lit targets (all behind the `powered` gate, so a removed
    // part or active fault kills every animation at once)
    switch (activeBoard.id) {
      case 2: // Fig. 02: the 5 mm LED blinks with the sketch cycle
        return id === "led2" && running ? blink : false;
      case 3: // Fig. 03: relay armature clacks with D9
        return id === "k1" && running ? blink : false;
      case 4: // Fig. 04: PWR LED steady, WS2812 cycles hues while running
        if (id === "ledpwr") return true;
        return id === "rgb" && running;
      case 5: // Fig. 05: the T transducer emits ping rings while running
        return id === "tx1" && running;
      default:
        // Fig. 01: Uno onboard LEDs
        if (id === "ledon") return true;
        if (!running) return false;
        if (id === "ledl") return blink;
        if (id === "ledtx") return flick;
        return false;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#EAE6DF] font-mono text-[#222]">
      <Sidebar board={board} onSelect={selectBoard} />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <ControlColumn
            fig={board + 1}
            title={activeBoard.name}
            viewMode={viewMode}
            onViewMode={setViewMode}
            glbAvailable={glbAvailable}
            actions={actions}
            color={color}
            onColorChange={setColor}
            labels={labels}
            onToggleLabels={() => setLabels((l) => !l)}
            exploded={exploded}
            usb={usb}
            faultActive={fault !== null}
            parts={parts}
            placed={placed}
            criticalParts={criticalParts}
            values={values}
            onTogglePart={togglePart}
            onValueChange={changeValue}
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
            running={running}
            values={values}
            eduFault={fault}
            viewMode={viewMode}
            onRemovePart={togglePart}
            onRepair={repairFault}
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
