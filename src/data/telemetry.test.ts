import {describe, it, expect} from 'vitest';
import {BOARDS_BY_ID} from './boards';
import {evaluateBoard} from '../engine/evaluateBoard';
import {getTelemetryLines} from './telemetry';
import type {BoardState} from './types';

function build(boardId: string, omitted: string[] = [], extra: Partial<BoardState> = {}): BoardState {
  const board = BOARDS_BY_ID[boardId];
  const ids = board.parts.filter((part) => !part.isMistake && !omitted.includes(part.id)).map((part) => part.id);
  const state: BoardState = {placedPartIds: ids, solderedPartIds: ids, burnedPartIds: [], isPowered: true, inputValues: {signal: true}, lastResult: null, ...extra};
  return {...state, lastResult: evaluateBoard(board, state)};
}
const lines = (id: string, state: BoardState, tick = 1) => getTelemetryLines(BOARDS_BY_ID[id], state, tick);

describe('telemetry', () => {
  it('unpowered boards say so', () => expect(lines('esp32', {...build('esp32'), isPowered: false, lastResult: null})[0].text).toMatch(/unpowered/));
  it('ESP32 connects, then reports signal strength', () => expect(lines('esp32', build('esp32'))[0].type).toBe('rx'));
  it('ESP32 without its capacitor browns out on the third tick', () => expect(lines('esp32', build('esp32', ['decouplingCap']), 2)[0].text).toMatch(/Brownout/));
  it('HC-SR04 reports a distance', () => expect(lines('hcsr04', build('hcsr04')).some((l) => /Distance: 2\d\.\d cm/.test(l.text))).toBe(true));
  it('HC-SR04 without a receiver times out', () => expect(lines('hcsr04', build('hcsr04', ['receiver'])).some((l) => /Echo timeout/.test(l.text))).toBe(true));
  it('TB6612 without STBY says the driver is asleep', () => expect(lines('tb6612', build('tb6612', ['standbyJumper'])).some((l) => /STBY/.test(l.text))).toBe(true));
  it('A4988 steps and counts position', () => expect(lines('a4988', build('a4988'), 2)[1].text).toBe('Position: +120 steps'));
  it('faults show up as error lines on every board', () => {
    Object.values(BOARDS_BY_ID).forEach((board) => {
      const state = build(board.id, [board.currentPaths[0][0]]); // remove the power source's first part
      expect(getTelemetryLines(board, state, 0).some((l) => l.type === 'error'), board.id).toBe(true);
    });
  });
});
