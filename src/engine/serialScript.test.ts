import {describe, it, expect} from 'vitest';
import {BOARDS_BY_ID} from '../data/boards';
import {evaluateBoard} from './evaluateBoard';
import {getSerialScript} from './serialScript';
import type {BoardState} from '../data/types';

/** A powered board with every part placed and soldered except those in `omitted`. */
function powered(boardId: string, omitted: string[] = []): BoardState {
  const board = BOARDS_BY_ID[boardId];
  const ids = board.parts.filter((part) => !part.isMistake && !omitted.includes(part.id)).map((part) => part.id);
  const state: BoardState = {placedPartIds: ids, solderedPartIds: ids, burnedPartIds: [], isPowered: true, inputValues: {signal: true}, lastResult: null};
  return {...state, lastResult: evaluateBoard(board, state)};
}

describe('serial script', () => {
  it('Fig. 01 has no serial output', () => expect(getSerialScript(BOARDS_BY_ID.led, powered('led'), true).repeats).toBe(false));
  it('waits for an upload first', () => expect(getSerialScript(BOARDS_BY_ID.uno, powered('uno'), false).lines[0]).toMatch(/Waiting/));
  it('prints the board output on a loop while running', () => {
    const script = getSerialScript(BOARDS_BY_ID.uno, powered('uno'), true);
    expect(script.repeats).toBe(true);
    expect(script.lines).toEqual(['LED on', 'LED off']);
  });
  it('prints an error line when the board faults', () => expect(getSerialScript(BOARDS_BY_ID.uno, powered('uno', ['crystal']), true).lines[0]).toMatch(/^!! /));
  it('every board except Fig. 01 has a sketch and serial lines', () => {
    Object.values(BOARDS_BY_ID).filter((board) => board.id !== 'led').forEach((board) => {
      expect(board.sketch, board.id).toBeTruthy();
      expect(board.serialOutput?.length, board.id).toBeGreaterThan(0);
    });
  });
});
