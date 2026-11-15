import { useEffect, useRef, useState } from "react";
import { Plus, Power, Usb, Layers, Cpu, Eraser, Flame } from "lucide-react";

import BottomPanels from "./components/BottomPanels";
import ControlColumn, { type BenchAction } from "./components/ControlColumn";
import Sidebar from "./components/Sidebar";
import Viewport3D from "./components/Viewport3D";
import { BOARD_SPECS } from "./data/boards";
import type { SimStatus } from "./types/simulator";

export default function App() {
  const [board, setBoard] = useState(0);
  const [placed, setPlaced] = useState<Set<string>>(
    () => new Set(BOARD_SPECS[0].parts.slice(0, 14).map((p) => p.id)),
  );
  const [soldered, setSoldered] = useState(false);
  const [usb, setUsb] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [running, setRunning] = useState(false);
  const [color, setColor] = useState("Blue");
  const [labels, setLabels] = useState(true);
  const [logs, setLogs] = useState<string[]>([
    "> Bench ready. Place the remaining parts.",
  ]);
  const [hover, setHover] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  const [flick, setFlick] = useState(false);
  const [explode, setExplode] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const bench = BOARD_SPECS[0];
  const parts = bench.parts;
  const total = parts.length;
  const activeBoard = BOARD_SPECS[board];
  const isUno = board === 0;

  const log = (s: string) => setLogs((l) => [...l.slice(-80), s]);
  const count = placed.size;
  const powered = usb && soldered && count === total;
  const status: SimStatus = running
    ? "RUNNING"
    : count === 0
      ? "BARE PCB"
      : count < total
        ? "ASSEMBLING"
        : !soldered
          ? "NEEDS SOLDER"
          : "READY";

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

  const actions: BenchAction[] = [
    {
      label: "Strip to bare PCB",
      icon: Eraser,
      fn: () => {
        setPlaced(new Set());
        setSoldered(false);
        stopIfBroken();
        log("> Stripped down to bare FR-4 PCB.");
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
        log("> Pick & place: 10 SMD parts reflowed.");
      },
    },
    {
      label: "Place a part",
      icon: Plus,
      fn: () => {
        const next = parts.find((p) => !placed.has(p.id));
        const nextSmd = parts.find((p) => p.smd && !placed.has(p.id));
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
        if (board !== 0)
          return log("! Only Fig. 01 is wired up on this bench.");
        if (count < total) return log(`! Missing ${total - count} parts.`);
        if (!soldered) return log("! Cold joints — solder the board first.");
        if (!usb) return log("! No power — plug in USB.");
        log("> avrdude: uploading Blink.ino ... done. 924 bytes.");
        setRunning(true);
      },
    },
  ];

  const litMap = (id: string) => {
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
      <Sidebar
        board={board}
        onSelect={(i) => {
          setBoard(i);
          setRunning(false);
        }}
      />

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
          />

          <Viewport3D
            spec={activeBoard}
            isUno={isUno}
            parts={activeBoard.parts}
            placed={placed}
            soldered={soldered}
            usb={usb}
            explode={explode}
            color={color}
            litMap={litMap}
            count={count}
            total={total}
            status={status}
            hover={hover}
            onHover={setHover}
          />
        </div>

        <BottomPanels
          spec={activeBoard}
          code={activeBoard.code || bench.code}
          logs={logs}
          running={running}
          usb={usb}
          logRef={logRef}
        />
      </main>
    </div>
  );
}
