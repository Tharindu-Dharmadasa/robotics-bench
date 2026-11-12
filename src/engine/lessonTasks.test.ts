import {describe, it, expect} from 'vitest';
import {BOARDS_BY_ID} from '../data/boards';
import {evaluateBoard} from './evaluateBoard';
import {getHint, getLessonTasks, getNextTask} from './lessonTasks';
import type {BoardState} from '../data/types';

const empty = (): BoardState => ({placedPartIds: [], solderedPartIds: [], burnedPartIds: [], isPowered: false, inputValues: {}, lastResult: null});
/** Build a board with every part placed except `omitted`; optionally soldered and powered. */
function build(boardId: string, {omitted = [] as string[], soldered = true, powered = true} = {}): BoardState {
  const board = BOARDS_BY_ID[boardId];
  const ids = board.parts.filter((part) => !part.isMistake && !omitted.includes(part.id)).map((part) => part.id);
  const state: BoardState = {...empty(), placedPartIds: ids, solderedPartIds: soldered ? ids : [], isPowered: powered, inputValues: {signal: true}};
  return {...state, lastResult: evaluateBoard(board, state)};
}

describe('lesson tasks', () => {
  const led = BOARDS_BY_ID.led;
  it('starts with "place every part"', () => expect(getNextTask(getLessonTasks(led, empty()))?.id).toBe('place'));
  it('a running board completes the first four tasks', () => {
    expect(getLessonTasks(led, build('led')).map((task) => task.isDone)).toEqual([true, true, true, true, false]);
  });
  it('"break" needs a burn, or having run before', () => {
    const noResistor = build('led', {omitted: ['resistor']});
    expect(getLessonTasks(led, {...noResistor, burnedPartIds: ['led']})[4].isDone).toBe(true);
    expect(getLessonTasks(led, build('led', {omitted: ['led']}))[4].isDone).toBe(false);          // never ran: just incomplete
    expect(getLessonTasks(led, build('led', {omitted: ['led']}), true)[4].isDone).toBe(true);     // ran before, then broke
  });
});

describe('hints', () => {
  const led = BOARDS_BY_ID.led;
  it('tells you the next part to place', () => expect(getHint(led, empty())).toMatch(/place the 5 V header/));
  it('tells you to solder before powering', () => expect(getHint(led, build('led', {soldered: false, powered: false}))).toMatch(/Solder/));
  it('points at the break when a part is missing', () => expect(getHint(led, build('led', {omitted: ['led']}))).toMatch(/Current stops at the Red LED/));
  it('explains a burned part', () => {
    const state = build('led', {omitted: ['resistor']});
    expect(getHint(led, {...state, burnedPartIds: ['led']})).toMatch(/Red LED burned out/);
  });
  it('suggests breaking it once it runs', () => expect(getHint(led, build('led'))).toMatch(/Now try to break it/));
});
