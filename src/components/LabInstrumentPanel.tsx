import { useEffect, useRef, useState, type ReactNode } from "react";

import type { EduFault } from "./Viewport3D";
import type { Part } from "../types/simulator";

/**
 * LabInstrumentPanel — retro-hardware instrument rack bolted under the bench
 * title. One module per lab (board indices 0–4 and 8–10); renders nothing
 * otherwise. Every interaction stays 2D DOM (AGENTS.md rule 1: never
 * <Html>/<Text> inside <Canvas>) and feeds structured faults / serial lines
 * back to the bench through the onFault / onLog callbacks.
 */
export interface LabInstrumentPanelProps {
  /** Zero-based active board index (0–4 · 8–10). */
  boardIndex: number;
  parts: Part[];
  placed: Set<string>;
  /** Configured part values, e.g. the resistor's "220Ω". */
  values: Record<string, string>;
  /** Is the board's sketch running? (drives the live D13 probe) */
  running: boolean;
  /** Blink phase of the running sketch (D13 HIGH half-cycle). */
  blink: boolean;
  /** Sonar target distance in cm (5–200), lifted to App for the 3D reflector. */
  targetDistance: number;
  onTargetDistance: (cm: number) => void;
  /** Fig. 03 · lifted D9 state (true = pin driven HIGH, 5 V base drive). */
  d9High?: boolean;
  /** Fig. 03 · request a D9 toggle; energize logic lives in App. */
  onD9Toggle?: (next: boolean) => void;
  /** Fig. 03 · fire the flyback watchdog on the D9 HIGH→LOW edge (App logic). */
  onTriggerBurnout?: () => void;
  /** Fig. 09 · IMU tilt-rig attitude in degrees (lifted to App for 3D + telemetry). */
  imuTilt?: { pitch: number; roll: number };
  onImuTiltChange?: (tilt: { pitch: number; roll: number }) => void;
  onImuReset?: () => void;
  /** Fig. 10 · KY-040 detent count + axial SW state (lifted to App). */
  encoderStep?: number;
  encoderPressed?: boolean;
  /** dir: 1 = CW (+1 detent), -1 = CCW (-1 detent). */
  onEncoderRotate?: (dir: 1 | -1) => void;
  onEncoderSetPressed?: (pressed: boolean) => void;
  /** Fig. 11 · PCA9685 servo angle 0–180° (lifted to App). */
  pcaAngle?: number;
  onPcaAngleChange?: (deg: number) => void;
  /** Raise a structured fault (HUD banner + repair flow). */
  onFault: (fault: EduFault) => void;
  /** Append a line to the serial monitor. */
  onLog: (line: string) => void;
}

/* ---------- shared retro hardware chrome ---------- */

/** Warm cream instrument module: crisp ink border, hard offset shadow,
 *  corner screws and a silkscreened module tag. */
function Module({ tag, title, children }: { tag: string; title: string; children: ReactNode }) {
  return (
    <div className="relative rounded-lg border-[1.5px] border-[#1E1E1C] bg-[#F6F3EC] p-3 font-mono text-xs shadow-[3px_3px_0_#1E1E1C]">
      {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((pos) => (
        <span
          key={pos}
          className={`absolute ${pos} h-1 w-1 rounded-full bg-[#C9C2B4] shadow-[inset_0_1px_1px_rgba(30,30,28,0.5)]`}
        />
      ))}
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#1E1E1C]/15 px-0.5 pb-1.5">
        <span className="shrink-0 text-[9px] font-bold tracking-widest text-[#1E1E1C]">{tag}</span>
        <span className="truncate text-[9px] tracking-widest text-[#6B655A]">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** Warm paper readout strip; warn = red alarm palette. */
function Lcd({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return (
    <div
      className={`rounded-md border-[1.5px] border-[#1E1E1C] bg-[#EFE9DC] px-2 py-1.5 font-mono text-[10px] leading-snug shadow-[inset_1px_1px_0_rgba(30,30,28,0.12)] ${
        warn ? "text-[#B3261E]" : "text-[#1E1E1C]"
      }`}
    >
      {children}
    </div>
  );
}

function Readout({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-[8px] tracking-widest text-[#6B655A]">{label}</span>
      <span
        className={`whitespace-nowrap font-mono text-[11px] font-bold ${
          warn ? "text-[#B3261E]" : "text-[#1E1E1C]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** Chunky tactile button with a hard offset shadow; active = latched (ink),
 *  danger = red accent. Optional pointer handlers turn it into a momentary
 *  switch (shaft press). */
function HwButton({
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  children,
  active = false,
  danger = false,
  disabled = false,
}: {
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  children: ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      disabled={disabled}
      className={`rounded-md border-[1.5px] border-[#1E1E1C] px-2 py-1 text-[9px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#1E1E1C] transition active:translate-y-px active:shadow-none ${
        disabled
          ? "cursor-not-allowed border-[#1E1E1C]/30 bg-[#E7E1D4] text-[#6B655A] shadow-none"
          : danger
            ? "bg-[#F6F3EC] text-[#B3261E] hover:bg-[#B3261E] hover:text-[#F6F3EC]"
            : active
              ? "bg-[#1E1E1C] text-[#F6F3EC]"
              : "bg-[#F6F3EC] text-[#1E1E1C] hover:bg-[#EFE9DC]"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- value helpers ---------- */

/** "220Ω" → 220, "1kΩ" → 1000, "4.7k" → 4700. */
const parseOhms = (raw: string): number | null => {
  const m = raw.match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return /k/i.test(raw) ? n * 1000 : n;
};

const fmtOhms = (o: number) => (o >= 1000 ? `${o / 1000}kΩ` : `${o}Ω`);

/* ---------- Fig. 01 · Arduino Uno — live D13 logic probe + reset pulse ---------- */

function D13Probe({
  running,
  blink,
  onLog,
}: Pick<LabInstrumentPanelProps, "running" | "blink" | "onLog">) {
  const [pulse, setPulse] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const resetPulse = () => {
    if (timer.current) return; // momentary — one pulse at a time
    setPulse(true);
    onLog("> RST pulled LOW — bootloader handshake…");
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setPulse(false);
      onLog(
        running
          ? "> Reset released — sketch restarted from vector 0x0000."
          : "> Reset released — board idle (no sketch running).",
      );
    }, 600);
  };

  const high = !pulse && running && blink;
  return (
    <>
      <Lcd>
        <div className="flex items-baseline justify-between">
          <span>D13 PIN · {pulse ? "RST LOW" : high ? "HIGH" : "LOW"}</span>
          <span className="text-[11px] font-bold">{pulse || !high ? "0.0 V" : "5.0 V"}</span>
        </div>
      </Lcd>
      <div className="mt-1.5 flex items-center gap-2">
        <HwButton onClick={resetPulse}>Reset Pulse</HwButton>
        <span
          title="D13 level LED"
          className={`ml-auto h-2 w-2 rounded-full ${
            high ? "bg-[#39d353] shadow-[0_0_6px_#39d353]" : "bg-[#C9C2B4]"
          }`}
        />
      </div>
    </>
  );
}

/* ---------- Fig. 02 · LED + resistor — live Ohm's-law meter ---------- */

const LED_VF = 2.0; // red LED forward voltage assumed by the bench's I model

function OhmMeter({
  parts,
  placed,
  values,
}: Pick<LabInstrumentPanelProps, "parts" | "placed" | "values">) {
  const res = parts.find((p) => p.kind === "res");
  const inPlace = !!res && placed.has(res.id);
  const ohms = res ? parseOhms(values[res.id] ?? res.value ?? "") : null;
  const iMa = inPlace && ohms ? ((5.0 - LED_VF) / ohms) * 1000 : 0;
  const over = inPlace && iMa > 20;

  return (
    <>
      <Lcd warn={over}>
        <Readout label="V SUPPLY" value="5.0 V" />
        <Readout label="R LOAD" value={inPlace && ohms ? fmtOhms(ohms) : "OPEN"} />
        <Readout
          label="I LED"
          value={
            inPlace && ohms
              ? `${iMa.toFixed(1)} mA${over ? "  !! OVER" : ""}`
              : "0.0 mA"
          }
          warn={over}
        />
      </Lcd>
      <div className="mt-1 text-[8px] tracking-widest text-[#6B655A]">
        I = (5.0 − Vf 2.0) / R · LIMIT 20 mA
      </div>
    </>
  );
}

/* ---------- Fig. 03 · transistor switch — D9 base drive + flyback watchdog ---------- */

function BaseDrive({
  parts,
  placed,
  d9High = false,
  onD9Toggle,
  onTriggerBurnout,
}: Pick<
  LabInstrumentPanelProps,
  "parts" | "placed" | "d9High" | "onD9Toggle" | "onTriggerBurnout"
>) {
  // flyback protection: any placed part matching "diode" / "1N4007" (id or name)
  const diode = parts.find(
    (p) => /diode|1n4007/i.test(p.id) || /diode|1n4007/i.test(p.name),
  );
  const guarded = !!diode && placed.has(diode.id);
  // D9 state + energize + burnout logic are lifted into App so the relay
  // closes bench-wide (3D + telemetry) even before Power on / Run. Snapping
  // HIGH→LOW additionally runs the inductive back-EMF watchdog.
  const toggle = () => {
    const next = !d9High;
    onD9Toggle?.(next);
    if (d9High && !next) onTriggerBurnout?.();
  };
  const d9 = d9High;

  // live telemetry: I_B = (5 V − V_BE) / 1kΩ ≈ 4.3 mA while the control loop
  // is intact; the relay only stays pulled-in with the load loop complete.
  const controlOk = ["rb", "q1"].every((id) => placed.has(id));
  const loadOk = ["p1", "k1", "q1"].every((id) => placed.has(id));
  const iBase = d9 && controlOk ? 4.3 : 0.0;
  const relayClosed = d9 && controlOk && loadOk;

  return (
    <>
      {/* tactile D9 base-input toggle */}
      <button
        onClick={toggle}
        className={`w-full rounded-md border-[1.5px] border-[#1E1E1C] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#1E1E1C] transition active:translate-y-px active:shadow-none ${
          d9
            ? "bg-[#1E1E1C] text-[#F6F3EC]"
            : "bg-[#F6F3EC] text-[#1E1E1C] hover:bg-[#EFE9DC]"
        }`}
      >
        D9 BASE INPUT: {d9 ? "5V HIGH" : "0V LOW"}
      </button>
      {/* compact live telemetry pills */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#1E1E1C] bg-[#EFE9DC] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1E1E1C]">
          <span className="font-medium opacity-60">I_base:</span>
          <span>{iBase.toFixed(1)} mA</span>
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            relayClosed
              ? "border-[#166534] bg-[#E3F0E3] text-[#166534]"
              : "border-[#1E1E1C] bg-[#EFE9DC] text-[#1E1E1C]"
          }`}
        >
          <span className="font-medium opacity-60">RELAY:</span>
          <span>{relayClosed ? "CLOSED (12V ON)" : "OPEN"}</span>
        </span>
        {/* flyback watchdog status */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            guarded
              ? "border-[#1E1E1C] bg-[#EFE9DC] text-[#1E1E1C]"
              : "border-[#B3261E] bg-[#F9E3DF] text-[#B3261E]"
          }`}
        >
          {guarded ? "1N4007 ✓" : "NO FLYBACK"}
        </span>
      </div>
    </>
  );
}

/* ---------- Fig. 04 · ESP32-S3 — WS2812 swatches + Wi-Fi TX burst ---------- */

const WS_SWATCHES = [
  { name: "RED", hex: "#ff1a3c" },
  { name: "GRN", hex: "#2bd96b" },
  { name: "BLU", hex: "#2b6bff" },
  { name: "AMB", hex: "#ffb020" },
  { name: "WHT", hex: "#f5f2ea" },
  { name: "OFF", hex: "#111111" },
];

function RadioBench({
  parts,
  placed,
  onFault,
  onLog,
}: Pick<LabInstrumentPanelProps, "parts" | "placed" | "onFault" | "onLog">) {
  const [sw, setSw] = useState(WS_SWATCHES[0]);

  const txBurst = () => {
    // the 10µF bulk cap: prefer the explicit 10µF value, else the first can cap
    const cap =
      parts.find(
        (p) =>
          (p.kind === "cap" || p.kind === "ecap") && /10\s*[µu]F/i.test(p.value ?? ""),
      ) ?? parts.find((p) => p.kind === "cap" || p.kind === "ecap");
    if (cap && !placed.has(cap.id)) {
      onFault({
        partId: cap.id,
        partName: cap.name,
        severity: "degraded",
        message:
          "BROWNOUT WARNING: the Wi-Fi TX burst pulls ~500mA spikes through the 3V3 rail. Without the 10µF bulk capacitor the rail sags below the ESP32-S3's brownout threshold and the radio resets mid-packet.",
      });
      return;
    }
    onLog(`> Wi-Fi TX burst OK · 3V3 rail stable · WS2812 ${sw.name} ${sw.hex}`);
  };

  return (
    <>
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span className="text-[8px] tracking-widest text-[#6B655A]">WS2812 · GPIO48</span>
        <span className="font-mono text-[9px] font-bold text-[#1E1E1C]">{sw.hex}</span>
      </div>
      <div className="mb-1.5 flex gap-1 px-0.5">
        {WS_SWATCHES.map((s) => (
          <button
            key={s.hex}
            title={`WS2812 → ${s.name}`}
            onClick={() => {
              setSw(s);
              onLog(`> WS2812 set to ${s.name} (${s.hex}).`);
            }}
            style={{ background: s.hex }}
            className={`h-4 w-4 rounded-sm border transition hover:scale-110 ${
              sw.hex === s.hex ? "border-[#1E1E1C] ring-1 ring-[#1E1E1C]" : "border-[#1E1E1C]/40"
            }`}
          />
        ))}
      </div>
      <HwButton onClick={txBurst} danger>
        Wi-Fi TX Burst
      </HwButton>
    </>
  );
}

/* ---------- Fig. 05 · ultrasonic — target distance slider + echo readout ---------- */

function SonarRanger({
  targetDistance,
  onTargetDistance,
}: Pick<LabInstrumentPanelProps, "targetDistance" | "onTargetDistance">) {
  const echoUs = Math.round(targetDistance * 58.31); // speed of sound ≈ 343 m/s round-trip
  return (
    <>
      <Lcd>
        <Readout label="TARGET" value={`${targetDistance} cm`} />
        <Readout label="ECHO" value={`${echoUs} µs`} />
      </Lcd>
      <input
        type="range"
        min={5}
        max={200}
        step={1}
        value={targetDistance}
        onChange={(e) => onTargetDistance(Number(e.target.value))}
        title="Move the reflector target 5–200 cm from the transducers"
        className="mt-2 w-full accent-[#B45309]"
      />
      <div className="mt-0.5 flex items-center justify-between text-[8px] tracking-widest text-[#6B655A]">
        <span>5 cm</span>
        <span className="animate-pulse text-[#B45309]">● PING</span>
        <span>200 cm</span>
      </div>
    </>
  );
}

/* ---------- Fig. 09 · MPU-6050 — IMU tilt rig (pitch/roll ±45°) ---------- */

function ImuTiltRig({
  imuTilt,
  onImuTiltChange,
  onImuReset,
}: Pick<
  LabInstrumentPanelProps,
  "imuTilt" | "onImuTiltChange" | "onImuReset"
>) {
  const pitch = imuTilt?.pitch ?? 0;
  const roll = imuTilt?.roll ?? 0;
  const fmtDeg = (v: number) =>
    `${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(1)}°`;
  return (
    <>
      <Lcd>
        <Readout label="PITCH" value={fmtDeg(pitch)} />
        <Readout label="ROLL" value={fmtDeg(roll)} />
        <Readout label="ACCEL Z" value={`${(Math.cos((pitch * Math.PI) / 180) * Math.cos((roll * Math.PI) / 180)).toFixed(2)} g`} />
      </Lcd>
      <input
        type="range"
        min={-45}
        max={45}
        step={1}
        value={pitch}
        onChange={(e) =>
          onImuTiltChange?.({ pitch: Number(e.target.value), roll })
        }
        title="Pitch the GY-521 rig -45°..+45° about the board's lateral axis"
        className="mt-2 w-full accent-[#B45309]"
      />
      <input
        type="range"
        min={-45}
        max={45}
        step={1}
        value={roll}
        onChange={(e) =>
          onImuTiltChange?.({ pitch, roll: Number(e.target.value) })
        }
        title="Roll the GY-521 rig -45°..+45° about the board's long axis"
        className="mt-1 w-full accent-[#B45309]"
      />
      <div className="mt-0.5 flex items-center justify-between text-[8px] tracking-widest text-[#6B655A]">
        <span>-45°</span>
        <span>PITCH / ROLL</span>
        <span>+45°</span>
      </div>
      <div className="mt-1.5">
        <HwButton onClick={() => onImuReset?.()}>Reset Level</HwButton>
      </div>
    </>
  );
}

/* ---------- Fig. 10 · KY-040 — detent rotator + axial SW press ---------- */

function EncoderDrive({
  encoderStep,
  encoderPressed,
  onEncoderRotate,
  onEncoderSetPressed,
}: Pick<
  LabInstrumentPanelProps,
  "encoderStep" | "encoderPressed" | "onEncoderRotate" | "onEncoderSetPressed"
>) {
  const step = encoderStep ?? 0;
  return (
    <>
      <Lcd warn={!!encoderPressed}>
        <div className="flex items-baseline justify-between">
          <span className="text-[8px] tracking-widest text-[#6B655A]">STEP</span>
          <span className="font-mono text-lg font-bold leading-none">{step}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[8px] tracking-widest text-[#6B655A]">
            SHAFT SW
          </span>
          <span className="font-mono text-[11px] font-bold">
            {encoderPressed ? "PRESSED" : "OPEN"}
          </span>
        </div>
      </Lcd>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <HwButton onClick={() => onEncoderRotate?.(-1)}>⟲ CCW</HwButton>
        <HwButton onClick={() => onEncoderRotate?.(1)}>⟳ CW</HwButton>
        <HwButton
          active={!!encoderPressed}
          onPointerDown={() => onEncoderSetPressed?.(true)}
          onPointerUp={() => onEncoderSetPressed?.(false)}
          onPointerLeave={() => onEncoderSetPressed?.(false)}
        >
          Press Shaft
        </HwButton>
      </div>
      <div className="mt-1 text-[8px] tracking-widest text-[#6B655A]">
        1 DETENT = π/10 SHAFT RAD · SW ZEROS COUNT
      </div>
    </>
  );
}

/* ---------- Fig. 11 · PCA9685 — 16-channel servo PWM drive ---------- */

function PwmServoDrive({
  pcaAngle,
  onPcaAngleChange,
}: Pick<LabInstrumentPanelProps, "pcaAngle" | "onPcaAngleChange">) {
  const angle = pcaAngle ?? 90;
  const pulseUs = Math.round(1000 + (angle / 180) * 1000);
  const duty = (pulseUs / 20000) * 100; // 50 Hz servo frame = 20 ms period
  return (
    <>
      <Lcd>
        <Readout label="ANGLE" value={`${angle}°`} />
        <Readout label="PULSE" value={`${pulseUs} µs`} />
        <Readout label="DUTY" value={`${duty.toFixed(2)}% @ 50Hz`} />
      </Lcd>
      <input
        type="range"
        min={0}
        max={180}
        step={1}
        value={angle}
        onChange={(e) => onPcaAngleChange?.(Number(e.target.value))}
        title="Drive all 16 PCA9685 channels with a 1.0–2.0 ms servo pulse"
        className="mt-2 w-full accent-[#B45309]"
      />
      <div className="mt-0.5 flex items-center justify-between text-[8px] tracking-widest text-[#6B655A]">
        <span>0°</span>
        <span className="animate-pulse text-[#B45309]">● CH 0–15</span>
        <span>180°</span>
      </div>
    </>
  );
}

/* ---------- module router ---------- */

export default function LabInstrumentPanel(props: LabInstrumentPanelProps) {
  const { boardIndex } = props;
  if (boardIndex < 0 || boardIndex > 10) return null;

  let tag = "";
  let title = "";
  let body: ReactNode = null;
  switch (boardIndex) {
    case 0:
      tag = "LP-01";
      title = "LOGIC PROBE · D13";
      body = <D13Probe {...props} />;
      break;
    case 1:
      tag = "DM-02";
      title = "LED BRANCH · I-V";
      body = <OhmMeter {...props} />;
      break;
    case 2:
      tag = "SG-03";
      title = "TRANSISTOR RELAY DRIVER";
      body = <BaseDrive {...props} />;
      break;
    case 3:
      tag = "RF-04";
      title = "ESP32-S3 RADIO";
      body = <RadioBench {...props} />;
      break;
    case 4:
      tag = "SR-05";
      title = "SONAR · HC-SR04";
      body = <SonarRanger {...props} />;
      break;
    case 8:
      tag = "IM-09";
      title = "IMU TILT · MPU-6050";
      body = <ImuTiltRig {...props} />;
      break;
    case 9:
      tag = "EN-10";
      title = "ROTARY · KY-040";
      body = <EncoderDrive {...props} />;
      break;
    case 10:
      tag = "PW-11";
      title = "PWM SERVO · PCA9685";
      body = <PwmServoDrive {...props} />;
      break;
    default:
      return null;
  }

  return (
    <Module tag={tag} title={title}>
      {body}
    </Module>
  );
}
