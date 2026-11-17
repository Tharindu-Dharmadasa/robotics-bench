/**
 * Telemetry State provided to the 500ms Serial Monitor generator.
 */
export interface TelemetryState {
  on?: boolean;
  ms?: number;
  values?: Record<string, string>;
  targetDistance?: number;
  d9High?: boolean;
  /** Fig. 09 · IMU tilt-rig attitude in degrees (drives the accel model). */
  imuTilt?: { pitch: number; roll: number };
  /** Fig. 10 · KY-040 live detent count, last step direction, axial SW. */
  encoderStep?: number;
  encoderDir?: "CW" | "CCW";
  encoderPressed?: boolean;
  /** Fig. 10 · true when the 100nF CLK/DT debounce caps are not both placed. */
  encoderJitter?: boolean;
  /** Fig. 11 · PCA9685 servo angle (0–180°) → 1.0–2.0 ms pulse. */
  pcaAngle?: number;
  /** Fig. 13 · false once the HMC5883L magnetometer (mag_ic) is removed —
   *  the complementary-filter yaw then drifts on uncalibrated gyro bias. */
  fusionMagLocked?: boolean;
  [key: string]: unknown;
}

/**
 * Clean 500ms Serial Monitor message generator for all 13 labs (01–13).
 *
 * @param boardIndex Zero-based board index (0–12).
 * @param tick Monotonic tick counter or timestamp step.
 * @param state Live simulator state (blink phase, part values, target distance, etc.).
 */
export function getBoardTelemetryLine(
  boardIndex: number,
  tick: number,
  state: TelemetryState = {},
): string {
  const ms = state.ms ?? (tick >= 500 ? tick : tick * 500);
  const on = state.on ?? tick % 2 !== 0;
  const values = state.values ?? {};
  const targetDistance = state.targetDistance ?? 25;
  const ts = `[${(ms / 1000).toFixed(1).padStart(5, " ")}s]`;

  switch (boardIndex) {
    case 0:
      // Fig. 01: Arduino Uno R3 — classic blink heartbeat
      return `${ts} ${on ? "LED ON" : "LED OFF"}`;

    case 1: {
      // Fig. 02: LED & resistor — Ohm's law current meter
      if (!on) return `${ts} LED OFF · I = 0 mA`;
      const r = (values["r1"] ?? "").toLowerCase();
      if (r.includes("10k")) return `${ts} LED ON · I = 0.3 mA (Dim)`;
      if (r.startsWith("10")) return `${ts} LED ON · I = 300 mA (OVERCURRENT)`;
      return `${ts} LED ON · I = 14.5 mA (220Ω)`;
    }

    case 2:
      // Fig. 03: Transistor switch — relay state
      return on || state.d9High
        ? `${ts} D9 HIGH -> 2N2222 SATURATED -> Relay Load ON (12V)`
        : `${ts} Relay OFF`;

    case 3: {
      // Fig. 04: ESP32-S3 — WiFi RSSI + RGB activity
      const core = Math.round(ms / 500) % 2;
      const rssi = -52 - Math.round((tick * 3) % 9);
      return `${ts} Core ${core}/1: WiFi RSSI ${rssi} dBm · GPIO48 RGB Pulse`;
    }

    case 4: {
      // Fig. 05: HC-SR04 Ultrasonic Sensor — live echo ranging with target distance
      const echoUs = Math.round(targetDistance * 58.31);
      return `${ts} HC-SR04 Ping: Echo ${echoUs} µs -> Distance: ${targetDistance.toFixed(1)} cm`;
    }

    case 5: {
      // Fig. 06: L298N driver — live motor PWM / current logs
      const fwd = Math.floor(tick / 3) % 2 === 0;
      const dir = fwd ? "FWD" : "REV";
      const currentMa = 415 + (tick % 5) * 8;
      return `${ts} MOTOR A: ${dir} @ 78% PWM (12.0V) · Current: ${currentMa} mA`;
    }

    case 6: {
      // Fig. 07: A4988 stepper driver — microstep counts (1/16 step mode)
      const uSteps = ((tick * 200) % 3200) + 200;
      const rev = Math.floor((tick * 200) / 3200) + 1;
      return `${ts} STEPPER: Step ${uSteps}/3200 uSteps (1/16 mode) · Rev ${rev} · I_coil: 1.2A`;
    }

    case 7: {
      // Fig. 08: SG90 servo — servo PWM µs / angle sweeps
      const sweep = [
        { angle: 0, us: 1000 },
        { angle: 45, us: 1250 },
        { angle: 90, us: 1500 },
        { angle: 135, us: 1750 },
        { angle: 180, us: 2000 },
        { angle: 135, us: 1750 },
        { angle: 90, us: 1500 },
        { angle: 45, us: 1250 },
      ];
      const pt = sweep[tick % sweep.length];
      return `${ts} SERVO PWM: ${pt.us} us -> Angle: ${pt.angle} deg`;
    }

    case 8: {
      // Fig. 09: MPU-6050 IMU — bench tilt rig → board-frame gravity model.
      // +pitch noses the board up about its lateral axis, +roll banks it
      // about its long axis; the accelerometer reports gravity projected on
      // the body axes:  ax = sin(pitch) · ay = −sin(roll) · az = cos·cos
      const pitch = state.imuTilt?.pitch ?? 0;
      const roll = state.imuTilt?.roll ?? 0;
      const p = (pitch * Math.PI) / 180;
      const r = (roll * Math.PI) / 180;
      // ±4 mg MEMS noise floor so a level board still streams micro-jitter
      const jitter = (i: number) => ((((tick * 7 + i * 3) % 5) - 2) * 0.004);
      const ax = (Math.sin(p) + jitter(0)).toFixed(3);
      const ay = (-Math.sin(r) + jitter(1)).toFixed(3);
      const az = (Math.cos(p) * Math.cos(r) + jitter(2)).toFixed(3);
      const fmtDeg = (v: number) =>
        `${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(1)}°`;
      return `${ts} IMU 0x68 | Accel: [${ax}, ${ay}, ${az}g] | Pitch: ${fmtDeg(pitch)} | Roll: ${fmtDeg(roll)}`;
    }

    case 9: {
      // Fig. 10: KY-040 rotary encoder — live detent count + shaft switch
      const step = state.encoderStep ?? 0;
      const dir = state.encoderDir ?? (step >= 0 ? "CW" : "CCW");
      const sw = state.encoderPressed ? "PRESSED" : "OPEN";
      if (state.encoderJitter) {
        // 100nF debounce cap unplaced: contact bounce fires 5–15 false
        // interrupts per detent, so the streamed count jumps around the
        // true shaft position.
        const bounce = 5 + ((tick * 11) % 11); // 5–15 false triggers
        const noisy = step + (((tick * 5) % 5) - 2); // ±2 counts of chatter
        return `${ts} KY-040 Step: ${noisy} | Dir: ${dir} | SW: ${sw} | !! CHATTER ×${bounce} — debounce cap unplaced`;
      }
      return `${ts} KY-040 Step: ${step} | Dir: ${dir} | SW: ${sw}`;
    }

    case 10: {
      // Fig. 11: PCA9685 servo driver — live angle → 1.0–2.0 ms pulse on
      // all 16 channels (50 Hz servo frame = 20 ms period)
      const angle = state.pcaAngle ?? 90;
      const pulseUs = Math.round(1000 + (angle / 180) * 1000);
      const duty = ((pulseUs / 20000) * 100).toFixed(2);
      return `${ts} PCA9685 [0x40] Ch0..15 PWM: ${pulseUs} µs (${angle}°) · ${duty}% duty @ 50Hz`;
    }

    case 11: {
      // Fig. 12: I2C OLED display — SSD1306 framebuffer scan @ 60 FPS
      // (1024 B = 128×64/8, driven from the 7.5V charge-pump boost rail)
      return `${ts} OLED [0x3C] Framebuffer 1024B @ 60FPS | V_boost = 7.5V`;
    }

    case 12: {
      // Fig. 13: MPU-6050 + HMC5883L 9-axis sensor fusion — live
      // complementary-filter quaternion stream. The magnetometer
      // magnetically locks yaw; with the HMC5883L (mag_ic) removed the
      // fused yaw diverges on uncalibrated gyro bias.
      const fmtDeg = (v: number) =>
        `${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(1)}°`;
      const pitch = 1.2 + Math.sin(tick * 0.9) * 0.2;
      const roll = -0.4 + Math.cos(tick * 0.7) * 0.15;
      if (state.fusionMagLocked === false) {
        const drift = (142.8 + tick * 4.7) % 360;
        return `${ts} 9-DOF QUATERNION | Pitch: ${fmtDeg(pitch)} | Roll: ${fmtDeg(roll)} | Yaw (Drifting): ${drift.toFixed(1)}° !! MAG LOST — HMC5883L (mag_ic) removed`;
      }
      const yaw = 142.8 + Math.sin(tick * 0.25) * 0.8;
      return `${ts} 9-DOF QUATERNION | Pitch: ${fmtDeg(pitch)} | Roll: ${fmtDeg(roll)} | Yaw (Mag-Locked): ${yaw.toFixed(1)}° N`;
    }

    default:
      return `${ts} ${on ? "LED ON" : "LED OFF"}`;
  }
}
