/**
 * Telemetry State provided to the 500ms Serial Monitor generator.
 */
export interface TelemetryState {
  on?: boolean;
  ms?: number;
  values?: Record<string, string>;
  targetDistance?: number;
  d9High?: boolean;
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
      // Fig. 09: MPU-6050 IMU — 6-axis accel + gyro stream
      const ax = (0.02 + ((tick % 3) - 1) * 0.01).toFixed(2);
      const ay = (-0.01 + (((tick + 1) % 3) - 1) * 0.01).toFixed(2);
      const az = (1.0 + (((tick + 2) % 3) - 1) * 0.01).toFixed(2);
      const gx = (0.4 + ((tick % 5) - 2) * 0.1).toFixed(1);
      const gy = (-0.2 + (((tick + 2) % 5) - 2) * 0.1).toFixed(1);
      const gz = (0.1 + (((tick + 4) % 5) - 2) * 0.1).toFixed(1);
      return `${ts} IMU 0x68 | Accel: [${ax}, ${ay}, ${az}g] | Gyro: [${gx}, ${gy}, ${gz} deg/s]`;
    }

    case 9: {
      // Fig. 10: Rotary encoder — quadrature count tracking
      const count = ((tick * 2) % 48) - 12;
      return `${ts} ENCODER: ${count} counts (Detent step, CLK/DT 90° quadrature)`;
    }

    case 10: {
      // Fig. 11: PCA9685 servo driver — 16-channel 12-bit PWM sweep
      const pulse = 205 + ((tick * 15) % 210);
      return `${ts} PCA9685: Sweeping 16 channels @ 50Hz (Pulse=${pulse}/4096)`;
    }

    case 11: {
      // Fig. 12: I2C OLED display — frame rendering rate
      return `${ts} OLED [0x3C]: 128x64 frame ${tick} rendered @ 30 FPS | VPP=7.5V`;
    }

    case 12: {
      // Fig. 13: MPU-6050 Sensor Fusion — complementary filter attitude
      const pitch = (14.0 + Math.sin(tick * 0.4) * 3.5).toFixed(1);
      const accelRef = (14.2 + Math.cos(tick * 0.4) * 3.2).toFixed(1);
      return `${ts} FUSION [dt=500ms]: Pitch=${pitch}° | AccelRef=${accelRef}° (98% Gyro + 2% Accel)`;
    }

    default:
      return `${ts} ${on ? "LED ON" : "LED OFF"}`;
  }
}
