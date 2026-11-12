// ─────────────────────────────────────────────────────────────────────────────
// Live serial telemetry for the boards with richer behaviour: ESP32-S3, HC-SR04
// and the motor drivers. Pure functions: (board, state, tick) -> lines.
// `tick` counts timer ticks since upload; it makes the numbers move and cycles faults.
// Plug it into your sketch's generateTelemetry and map each line to a SerialLogEntry.
// ─────────────────────────────────────────────────────────────────────────────
import type {BoardDefinition, BoardState} from './types';

export type TelemetryType = 'system' | 'rx' | 'tx' | 'error';
export interface TelemetryLine {type: TelemetryType; text: string}
const line = (type: TelemetryType, text: string): TelemetryLine => ({type, text});

export function getTelemetryLines(board: BoardDefinition, state: BoardState, tick: number): TelemetryLine[] {
  const result = state.lastResult;
  if (!state.isPowered || !result) return [line('system', 'Board is unpowered.')];
  // A part only works if it is placed AND soldered AND not burned (same rule as the engine).
  const works = (id: string) => state.placedPartIds.includes(id) && state.solderedPartIds.includes(id) && !state.burnedPartIds.includes(id);

  switch (board.id) {
    case 'esp32': {
      if (state.burnedPartIds.includes('espModule')) return [line('error', "Guru Meditation Error: Core 0 panic'ed (GPIO overvoltage)"), line('error', result.message)];
      if (result.status !== 'RUNNING') return [line('error', result.message)];
      if (!works('decouplingCap') && tick % 3 === 2) return [line('error', 'Brownout detector was triggered'), line('system', 'rst:0xf (BROWNOUT_RST), booting...')];
      return tick === 0 ? [line('system', 'Connecting to Wi-Fi...')] : [line('rx', 'Connected: IP 192.168.1.42, signal -58 dBm')];
    }
    case 'hcsr04': {
      if (state.burnedPartIds.includes('controllerChip')) return [line('error', result.message)];
      if (!works('crystal')) return [line('error', 'Timing error: no 40 kHz burst generated')];
      if (!works('transmitter')) return [line('tx', 'TRIG pulse sent (10 us)'), line('error', 'Nothing was transmitted: distance = -1')];
      if (!works('receiver')) return [line('tx', 'TRIG pulse sent (10 us)'), line('error', 'Echo timeout: pulseIn() returned 0')];
      if (result.status !== 'RUNNING') return [line('error', result.message)];
      const centimetres = 23.4 + [0, -0.2, 0.1, -0.1][tick % 4]; // a hand hovering about 23 cm away
      return [line('tx', 'TRIG pulse sent (10 us)'), line('rx', `Distance: ${centimetres.toFixed(1)} cm`)];
    }
    case 'tb6612': {
      if (state.burnedPartIds.includes('driverChip')) return [line('error', result.message)];
      if (!works('standbyJumper') && works('driverChip')) return [line('tx', 'AIN1=HIGH AIN2=LOW PWMA=200'), line('error', 'STBY pin is low: driver asleep, commands ignored')];
      if (result.status !== 'RUNNING') return [line('error', result.message)];
      const lines = [line('tx', 'AIN1=HIGH AIN2=LOW PWMA=200'), line('rx', `Motor current: ${result.currentMilliamps} mA`)];
      return works('bulkCap') ? lines : [...lines, line('error', 'Warning: supply ripple 1.2 V, brown-out risk')];
    }
    case 'l298n': {
      if (result.status !== 'RUNNING') return [line('error', result.message)];
      return [line('tx', 'IN1=HIGH IN2=LOW ENA=180'), line('rx', `Chip temperature: ${55 + (tick % 4)} C`)];
    }
    case 'a4988': {
      if (result.status !== 'RUNNING') return [line('error', result.message)];
      const mode = works('microstepHeader') ? '1/16 microstep, 625 steps/s' : 'full step (MS pins floating), 40 steps/s';
      return [line('system', `Stepping: ${mode}`), line('rx', `Position: +${(tick + 1) * 40} steps`)];
    }
    default: // every other board: loop its serialOutput while running, show the rule's message otherwise
      return result.status === 'RUNNING' && board.serialOutput?.length
        ? [line('rx', board.serialOutput[tick % board.serialOutput.length])]
        : [line('error', result.message)];
  }
}
