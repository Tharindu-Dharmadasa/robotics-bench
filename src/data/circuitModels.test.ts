import {describe, it, expect} from 'vitest';
import {BOARDS_BY_ID} from './boards';
import {evaluateBoard} from '../engine/evaluateBoard';
import {analyzeLedBoard, analyzeTransistorBoard} from './circuitModels';
import {formatOhms, ohmsToBands} from './parameters';
import type {BoardState} from './types';

const valuesOf = (values: Record<string, number | string>) => (id: string) => values[id];
const LED = {power: 5, resistor: 330, led: 'red'};
const NPN = {power: 5, baseResistor: 1000, ledResistor: 330, led: 'green'};

describe('LED physics', () => {
  it('330 Ω on 5 V gives about 9 mA (Ohm: (5 - 2) / 330)', () => expect(analyzeLedBoard(valuesOf(LED)).currentMilliamps).toBe(9));
  it('a small resistor over-drives the LED but does not kill it yet', () => {
    const result = analyzeLedBoard(valuesOf({...LED, resistor: 100}));   // 30 mA
    expect(result.status).toBe('RUNNING');
    expect(result.message).toMatch(/above the 20 mA rating/);
  });
  it('a much smaller resistor burns the LED', () => {
    const result = analyzeLedBoard(valuesOf({...LED, resistor: 47}));
    expect(result.status).toBe('FAULT');
    expect(result.burnedPartIds).toEqual(['led']);
  });
  it('a big resistor makes it dim', () => expect(analyzeLedBoard(valuesOf({...LED, resistor: 10000})).message).toMatch(/barely visible/));
  it('a higher supply voltage raises the current', () => expect(analyzeLedBoard(valuesOf({...LED, power: 9, resistor: 470})).currentMilliamps).toBe(15));
  it('blue needs more voltage than red: less current on 3.3 V', () => {
    expect(analyzeLedBoard(valuesOf({...LED, power: 3.3, led: 'blue'})).currentMilliamps!).toBeLessThan(analyzeLedBoard(valuesOf({...LED, power: 3.3})).currentMilliamps!);
  });
  it('too little voltage cannot light the LED', () => expect(analyzeLedBoard(valuesOf({...LED, power: 1.5})).status).toBe('IDLE'));
});

describe('transistor physics', () => {
  it('saturates with the default values', () => expect(analyzeTransistorBoard(valuesOf(NPN)).message).toMatch(/Saturated/));
  it('a huge base resistor starves the transistor: not saturated, LED dim', () => expect(analyzeTransistorBoard(valuesOf({...NPN, baseResistor: 100000})).message).toMatch(/Not saturated/));
  it('a tiny base resistor burns the transistor', () => expect(analyzeTransistorBoard(valuesOf({...NPN, baseResistor: 10})).burnedPartIds).toEqual(['transistor']));
  it('a tiny LED resistor burns the LED', () => expect(analyzeTransistorBoard(valuesOf({...NPN, ledResistor: 47})).burnedPartIds).toEqual(['led']));
});

describe('part values drive the engine', () => {
  const board = BOARDS_BY_ID.led;
  const build = (partValues?: BoardState['partValues']) => {
    const ids = board.parts.map((part) => part.id);
    return evaluateBoard(board, {placedPartIds: ids, solderedPartIds: ids, burnedPartIds: [], isPowered: true, inputValues: {}, lastResult: null, partValues})!;
  };
  it('defaults still run', () => expect(build().status).toBe('RUNNING'));
  it('a 47 Ω resistor burns the LED through the full engine', () => {
    const result = build({resistor: 47});
    expect(result.status).toBe('FAULT');
    expect(result.burnedPartIds).toEqual(['led']);
  });
  it('the result carries the working for the Live calculation panel', () => expect(build().details?.[1]).toBe('I = (5 - 2) / 330 = 9.1 mA'));
});

describe('resistor helpers', () => {
  it('colour bands follow the real code', () => {
    expect(ohmsToBands(330)).toEqual(['#e07a1f', '#e07a1f', '#7a4a1e']);      // orange, orange, brown
    expect(ohmsToBands(1000)).toEqual(['#7a4a1e', '#1a1a1a', '#c62828']);     // brown, black, red
    expect(ohmsToBands(4700)).toEqual(['#e6c619', '#7b3fa0', '#c62828']);     // yellow, violet, red
  });
  it('formats values', () => { expect(formatOhms(330)).toBe('330 Ω'); expect(formatOhms(4700)).toBe('4.7 kΩ'); expect(formatOhms(100000)).toBe('100 kΩ'); });
});
