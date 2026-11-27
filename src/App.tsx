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
import { getBoardTelemetryLine } from "./data/telemetry";
import { oledBench } from "./components/boards/Fig12Oled";
import { fusionBench } from "./components/boards/Fig13Fusion";
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

/** Serial-monitor tag for a PartEffect consequence (value-change path). */
const effectTag = (severity: PartEffect["severity"]) =>
  severity === "burnout" ? "BURNOUT" : severity === "halt" ? "HALT" : "WARN";

export default function App() {
  const [board, setBoard] = useState(0);
  /** Custom Experiment Bench (sandbox) open — replaces the standard board stage. */
  // Removed old sandbox prototype state
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
  /** Sonar target distance (cm) from the lab instrument panel, shared with the 3D reflector. */
  const [targetDistance, setTargetDistance] = useState(25);
  /** Fig. 03 · lifted D9 pin state (true = 5 V base drive, relay closed). */
  const [d9High, setD9High] = useState(false);
  /** Fig. 09 · IMU tilt-rig attitude in degrees (drives the 3D board tilt + accel telemetry). */
  const [imuTilt, setImuTilt] = useState({ pitch: 0, roll: 0 });
  /** Fig. 10 · KY-040 live detent count + axial SW press state. */
  const [encoderStep, setEncoderStep] = useState(0);
  const [encoderPressed, setEncoderPressed] = useState(false);
  /** Fig. 11 · PCA9685 servo angle 0–180° (1.0–2.0 ms pulse on all 16 channels). */
  const [pcaAngle, setPcaAngle] = useState(90);
  /** 3D jumper-wire + current-flow overlay toggle (ControlColumn switch). */
  const [showWires, setShowWires] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  // live mirror of `values` for the telemetry interval (no timer restarts)
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const targetDistanceRef = useRef(targetDistance);
  targetDistanceRef.current = targetDistance;
  const d9HighRef = useRef(d9High);
  d9HighRef.current = d9High;
  // live mirrors of the Fig. 09–11 instrument state for the telemetry interval
  const imuTiltRef = useRef(imuTilt);
  imuTiltRef.current = imuTilt;
  const encoderStepRef = useRef(encoderStep);
  encoderStepRef.current = encoderStep;
  const encoderPressedRef = useRef(encoderPressed);
  encoderPressedRef.current = encoderPressed;
  const pcaAngleRef = useRef(pcaAngle);
  pcaAngleRef.current = pcaAngle;
  // live mirror of the placed set for the telemetry interval (no restarts)
  const placedRef = useRef(placed);
  placedRef.current = placed;
  // Fig. 10 · last detent direction (from the CW/CCW buttons) for the stream
  const encoderDirRef = useRef<"CW" | "CCW">("CW");
  // Fig. 10 · both 100nF CLK/DT debounce caps placed → clean counts, otherwise chatter
  const encoderDebounceOkRef = useRef(true);
  encoderDebounceOkRef.current =
    placed.has("c_clk") && placed.has("c_dt");

  const activeBoard = BOARD_SPECS[board];
  const parts = activeBoard.parts;
  const total = parts.length;
  const criticalParts = activeBoard.faultRule?.criticalParts ?? [];

  /**
   * The part that caused / owns the active fault: for burnout it is the
   * damaged victim (effect.damagedPartId ?? the culprit), otherwise the part
   * the learner interacted with. Its id + [x, z] coords anchor the 3D
   * burnout visuals and missing-part locator rings.
   */
  const faultPart = fault
    ? parts.find(
        (p) =>
          p.id ===
          (fault.severity === "burnout"
            ? (fault.burnPartId ?? fault.partId)
            : fault.partId),
      )
    : undefined;

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
    // Selecting a real board leaves the sandbox and returns to the bench.

    setPlaced(initialPlaced(spec));
    setSoldered(false);
    setUsb(false);
    setExploded(false);
    setRunning(false);
    setFault(null);
    setBlink(false);
    setFlick(false);
    setHover(null);
    setD9High(false);
    setTargetDistance(25);
    setImuTilt({ pitch: 0, roll: 0 });
    setEncoderStep(0);
    setEncoderPressed(false);
    setPcaAngle(90);
    encoderDirRef.current = "CW";
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
    // values, targetDistance, d9 and the Fig. 09–11 instrument state are read
    // through refs inside the tick, so live slider adjustments mid-run update
    // the next telemetry line immediately.
    let on = false;
    let ms = 0;
    let tick = 0;
    const id = setInterval(() => {
      on = !on;
      tick++;
      ms += 500;
      setBlink(on);
      setFlick(true);
      setTimeout(() => setFlick(false), 80);
      log(
        getBoardTelemetryLine(board, tick, {
          on,
          ms,
          values: valuesRef.current,
          targetDistance: targetDistanceRef.current,
          d9High: d9HighRef.current,
          imuTilt: imuTiltRef.current,
          encoderStep: encoderStepRef.current,
          encoderDir: encoderDirRef.current,
          encoderPressed: encoderPressedRef.current,
          encoderJitter: !encoderDebounceOkRef.current,
          pcaAngle: pcaAngleRef.current,
          // Fig. 13 · mag_ic removed → the fused yaw line starts drifting
          fusionMagLocked: placedRef.current.has("mag_ic"),
        }),
      );
    }, 500);
    return () => clearInterval(id);
  }, [running, board]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  // Fig. 12/13 · publish open-pad locator + magnetometer lock state onto
  // the board-module bench buses (same cross-component pattern as the
  // KY-040's ky040Shaft and the PCA9685's pca9685Pwm): the PCBs pulse
  // red/amber fault rings on the empty pads of removed parts, and the
  // Fig. 13 yaw compass drifts once the HMC5883L is lifted.
  useEffect(() => {
    const missing = new Set(
      parts.filter((p) => !placed.has(p.id)).map((p) => p.id),
    );
    oledBench.missing = missing;
    fusionBench.missing = missing;
    fusionBench.magOk = placed.has("mag_ic");
  }, [placed, parts]);

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
    opts: { keepRunning?: boolean; tag?: string } = {},
  ) => {
    // A degraded consequence (e.g. 10kΩ starved LED) keeps the sketch running
    // — the board still works, just badly; burnout/halt shut it down.
    const keep = !!opts.keepRunning && eff.severity === "degraded";
    if (!keep) {
      setRunning(false);
      setBlink(false);
    }
    // Physical burnout lands on the named victim while it is still placed;
    // otherwise the culprit's own (possibly now-empty) PCB pad scorches.
    const named = eff.damagedPartId
      ? parts.find((p) => p.id === eff.damagedPartId)
      : undefined;
    const burnId =
      eff.severity === "burnout"
        ? named && placed.has(named.id)
          ? named.id
          : part.id
        : eff.damagedPartId;
    const burn = parts.find((p) => p.id === burnId);
    setFault({
      partId: part.id,
      partName: burn?.name ?? part.name,
      severity: eff.severity,
      message: eff.message,
      burnPartId: burnId,
    });
    log(`! ${opts.tag ?? "ERROR"}: ${eff.message}`);
  };

  /** Change a part's configured value (e.g. 1kΩ → 10Ω) from the parts list. */
  const changeValue = (id: string, opt: string) => {
    const part = parts.find((p) => p.id === id);
    if (!part || !part.valueOptions?.includes(opt)) return;
    setValues((v) => ({ ...v, [id]: opt }));
    log(`> ${part.name} set to ${opt}.`);
    const eff = part.valueEffects?.[opt];
    if (!eff) {
      // Value auto-recovery: dialling back to a nominal value clears any fault
      // this part raised, so the banner/burn damage/locator ring all reset.
      if (fault && (fault.partId === id || fault.burnPartId === id)) {
        setFault(null);
        log("> Fault cleared — value back to nominal, board ready.");
      }
      return;
    }
    // Live valueEffects evaluation: on a powered or running board the
    // consequence fires the instant the new value is dialled in —
    //   burnout  → damaged part dies, status FAULT, sketch stops
    //   halt     → sketch halts with a fault banner
    //   degraded → keeps running under a warning banner
    const boardPowered =
      usb &&
      soldered &&
      count === total &&
      (!fault || fault.severity === "degraded");
    if ((boardPowered || running) && placed.has(id)) {
      raiseEffect(part, eff, {
        keepRunning: true,
        tag: effectTag(eff.severity),
      });
    } else
      log(
        `> Power the assembled board to see what ${opt} does to this circuit.`,
      );
  };

  /** Structured fault raised from the lab instrument panel (2D controls). */
  const raiseInstrumentFault = (f: EduFault) => {
    // degraded (e.g. the brownout warning) keeps the sketch running, like raiseEffect
    if (f.severity !== "degraded") {
      setRunning(false);
      setBlink(false);
    }
    setFault(f);
    log(`! ERROR: ${f.message}`);
  };

  /* ---------- Fig. 03 · lifted D9 base drive ---------- */

  /** Parts the 2N2222 control/load loops need for the relay to actually pull in. */
  const FIG3_LOOP_PARTS = ["q1", "rb", "k1"];
  /** True when D9 HIGH really energises the coil: USB/power in, loop complete. */
  const d9Energized =
    activeBoard.id === 3 &&
    d9High &&
    usb &&
    FIG3_LOOP_PARTS.every((id) => placed.has(id)) &&
    (!fault || fault.severity === "degraded");

  useEffect(() => {
    if (d9Energized)
      log("> D9 HIGH: 2N2222 base energised — 5V relay K1 armature pulled in.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d9Energized]);

  /**
   * D9 toggle from the SG-03 base-drive instrument. HIGH immediately drives
   * the 2N2222 base (relay closes even before Power on / Run). The HIGH→LOW
   * flyback check is a separate lifted callback (d9TriggerBurnout) so the
   * instrument can fire it explicitly on the falling edge.
   */
  const d9Toggle = (next: boolean) => {
    if (next === d9High) return;
    setD9High(next);
    log(
      next
        ? "> D9 → HIGH · base drive 5V (2N2222 saturating)"
        : "> D9 → LOW · base drive 0V",
    );
  };

  /**
   * Flyback watchdog, fired by the instrument when D9 snaps from HIGH to LOW:
   * scan the placed parts on Fig. 03 case-insensitively for a diode / 1N4007.
   * If none is placed while the coil was actually carrying current (USB in,
   * control + load loop complete, no active fault), the 2N2222 dies from the
   * inductive back-EMF spike immediately.
   */
  const d9TriggerBurnout = () => {
    if (activeBoard.id !== 3) return;

    const diodePlaced = parts.some(
      (p) =>
        placed.has(p.id) &&
        (/diode|1n4007/i.test(p.id) || /diode|1n4007/i.test(p.name)),
    );
    // the coil only spikes if it was actually carrying current
    const coilWasLive =
      usb &&
      FIG3_LOOP_PARTS.every((id) => placed.has(id)) &&
      (!fault || fault.severity === "degraded");
    if (diodePlaced || !coilWasLive) return;

    const q = parts.find((p) => p.kind === "to92");
    const msg =
      "BURNOUT: 1N4007 Flyback Diode missing — >65V coil spike destroyed 2N2222!";
    setFault({
      partId: q?.id ?? "q1",
      partName: q?.name ?? "2N2222",
      severity: "burnout",
      message: msg,
      burnPartId: q?.id,
    });
    log(`! ${msg}`);
  };

  /* ---------- Fig. 09 · IMU tilt rig · Fig. 10 · KY-040 · Fig. 11 · PCA9685 ---------- */

  /** Tilt-rig sliders (±45°): the 500 ms stream carries the live values. */
  const imuTiltChange = (tilt: { pitch: number; roll: number }) =>
    setImuTilt(tilt);

  /** Re-level the GY-521 rig (accel returns to [0, 0, +1g]). */
  const imuResetLevel = () => {
    setImuTilt({ pitch: 0, roll: 0 });
    log("> MPU-6050 tilt rig zeroed — board level (0.0°, 0.0°).");
  };

  /** KY-040 detent step from the ⟲/⟳ buttons (one detent = π/10 shaft rad). */
  const encoderRotate = (dir: 1 | -1) => {
    const next = encoderStep + dir;
    encoderDirRef.current = dir === 1 ? "CW" : "CCW";
    setEncoderStep(next);
    log(`> KY-040 detent ${dir === 1 ? "CW ⟳" : "CCW ⟲"} → step ${next}.`);
  };

  /**
   * KY-040 axial SW (active-LOW, momentary): pressing grounds SW and the
   * sketch zeroes the count — same as the board's real firmware loop.
   */
  const encoderSetPressed = (pressed: boolean) => {
    setEncoderPressed(pressed);
    if (pressed) {
      setEncoderStep(0);
      log("> KY-040 SW pressed (active-LOW) — encoder count zeroed.");
    } else {
      log("> KY-040 SW released (pull-up HIGH).");
    }
  };

  /** PCA9685 servo angle slider (0–180°) → 1.0–2.0 ms pulse, all 16 channels. */
  const pcaAngleChange = (deg: number) => setPcaAngle(deg);

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
        if (part.onRemoveEffect) {
          // burnout  → victim (or the empty pad) scorches, status FAULT, stop
          // halt     → open circuit, status FAULT, everything goes dark
          // degraded → sketch keeps running under an amber warning banner
          raiseEffect(part, part.onRemoveEffect, {
            keepRunning: true,
            tag: effectTag(part.onRemoveEffect.severity),
          });
          return;
        }
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
      // Re-place auto-recovery: putting the faulted part back clears the fault
      // state (banner, burn damage, locator ring) so the board runs clean again.
      if (fault && (fault.partId === id || fault.burnPartId === id)) {
        setFault(null);
        log("> Fault cleared — part restored, board ready.");
      }
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

        // Enforce complete assembly on every lab: power-on is refused until
        // every part is placed and the exact missing list is printed. Hot-swap
        // removal after the board is running still works — its consequence is
        // raised separately in togglePart.
        if (count < total) {
          const missing = parts.filter((p) => !placed.has(p.id));
          log(
            `! INCOMPLETE ASSEMBLY: Place all parts before powering on (Missing: ${missing.map((p) => p.name).join(", ")})`,
          );
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
          raiseEffect(unsafe, eff, {
            keepRunning: true,
            tag: effectTag(eff.severity),
          });
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
    if (part.kind === "servo") return powered && running;
    if (part.kind === "oled") {
      // Fig. 12: the SSD1306 glass is emissive while the sketch runs AND
      // the 1µF charge-pump boost caps + 662K 3.3V LDO are seated — pull
      // either one and the 7.5V bias rail dies, blanking the screen.
      if (activeBoard.id === 11)
        return (
          powered &&
          running &&
          placed.has("cap_cpump1") &&
          placed.has("ldo_oled")
        );
      return powered && running;
    }
    if (!powered) return false;
    // board-specific lit targets (all behind the `powered` gate, so a removed
    // part or active fault kills every animation at once)
    switch (activeBoard.id) {
      case 2: // Fig. 02: the 5 mm LED blinks with the sketch cycle
        return id === "led2" && running ? blink : false;
      case 3: // Fig. 03: relay armature clacks with the sketch cycle — or
        // immediately when D9 is driven HIGH before Power on / Run
        return id === "k1" ? (running ? blink : false) || d9Energized : false;
      case 4: // Fig. 04: PWR LED steady, WS2812 cycles hues while running
        if (id === "ledpwr") return true;
        return id === "rgb" && running;
      case 5: // Fig. 05: the T transducer emits ping rings while running
        return id === "tx1" && running;
      case 12: {
        // Fig. 13: both MEMS QFNs (MPU-6050 DMP IMU + HMC5883L magnetometer)
        // stream with the sketch; the fusion-lock LED holds solid only while
        // the magnetometer keeps the yaw magnetically locked.
        if (part.kind === "imu") return running;
        if (id === "led_lock") return running && placed.has("mag_ic");
        return false;
      }
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
      <Sidebar
        board={board}
        onSelect={selectBoard}

      />

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
            boardIndex={board}
            running={running}
            blink={blink}
            targetDistance={targetDistance}
            onTargetDistance={setTargetDistance}
            d9High={d9High}
            onD9Toggle={d9Toggle}
            onTriggerBurnout={d9TriggerBurnout}
            imuTilt={imuTilt}
            onImuTiltChange={imuTiltChange}
            onImuReset={imuResetLevel}
            encoderStep={encoderStep}
            encoderPressed={encoderPressed}
            onEncoderRotate={encoderRotate}
            onEncoderSetPressed={encoderSetPressed}
            pcaAngle={pcaAngle}
            onPcaAngleChange={pcaAngleChange}
            showWires={showWires}
            onToggleWires={() => setShowWires((w) => !w)}
            onInstrumentFault={raiseInstrumentFault}
            onInstrumentLog={log}
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
              blink={blink}
              values={values}
              eduFault={fault}
              damagedPartId={faultPart?.id}
              faultPartId={faultPart?.p}
              viewMode={viewMode}
              showWires={showWires}
              d9Energized={d9Energized}
              imuTilt={imuTilt}
              encoderStep={encoderStep}
              encoderPressed={encoderPressed}
              pcaAngle={pcaAngle}
              onRemovePart={togglePart}
              onRepair={repairFault}
              hover={hover}
              onHover={setHover}
              onGlbFallback={() =>
                log("> No usable .glb model — procedural scene engaged.")
              }
              targetDistance={targetDistance}
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
