// Tests the store's core actions. Each test starts from a clean store; fake timers skip the
// 330 ms pauses between "place all" / "solder all" steps so the tests run instantly.
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useBenchStore} from './benchStore';

const initialState = useBenchStore.getState();
const store = () => useBenchStore.getState();
const board = (id = 'led') => store().boardStates[id];
/** Let a step-by-step action (which awaits timers) run to the end. */
async function finish(action: Promise<void>) {
  let done = false;
  action.then(() => { done = true; });
  while (!done) {
    await vi.advanceTimersByTimeAsync(350);
  }
}
/** Place, solder and power the current board. */
async function buildAndPower() {
  await finish(store().placeAllParts());
  await finish(store().solderAllParts());
  store().togglePower();
}

beforeEach(() => { useBenchStore.setState(initialState, true); vi.useFakeTimers(); });
afterEach(() => { store().stopTelemetry(); vi.useRealTimers(); });

describe('bench store', () => {
  it('togglePart places a part, then removes it', () => {
    store().togglePart('power');
    expect(board().placedPartIds).toEqual(['power']);
    store().togglePart('power');
    expect(board().placedPartIds).toEqual([]);
  });

  it('solderAllParts solders only the parts that are placed', async () => {
    store().togglePart('power'); store().togglePart('led');
    await finish(store().solderAllParts());
    expect(board().solderedPartIds.sort()).toEqual(['led', 'power']);
  });

  it('removing a part also un-solders it', async () => {
    store().togglePart('power');
    await finish(store().solderAllParts());
    store().togglePart('power');
    expect(board().solderedPartIds).toEqual([]);
  });

  it('a complete LED board runs when powered', async () => {
    await buildAndPower();
    expect(board().lastResult?.status).toBe('RUNNING');
    expect(board().lastResult?.litPartIds).toEqual(['led']);
  });

  it('powering without the resistor burns the LED, and the burn persists', async () => {
    await finish(store().placeAllParts());
    store().togglePart('resistor');                       // remove the resistor
    await finish(store().solderAllParts());
    store().togglePower();
    expect(board().lastResult?.status).toBe('FAULT');
    expect(board().burnedPartIds).toContain('led');
    store().togglePart('resistor');                       // putting the resistor back does not heal the LED
    expect(board().burnedPartIds).toContain('led');
  });

  it('removing a burnt part clears the burn so it can be replaced', async () => {
    await finish(store().placeAllParts());
    store().togglePart('resistor');
    await finish(store().solderAllParts());
    store().togglePower();
    store().togglePart('led');
    expect(board().burnedPartIds).not.toContain('led');
  });

  it('resetBoard clears everything for that board', async () => {
    await buildAndPower();
    store().resetBoard();
    expect(board()).toMatchObject({placedPartIds: [], solderedPartIds: [], burnedPartIds: [], isPowered: false, lastResult: null});
  });

  it('each board keeps its own progress', () => {
    store().togglePart('power');
    store().selectBoard('uno');
    expect(board('uno')?.placedPartIds ?? []).toEqual([]);
    store().selectBoard('led');
    expect(board('led').placedPartIds).toEqual(['power']);
  });

  it('"place all" skips mistake parts', async () => {
    store().selectBoard('esp32');
    await finish(store().placeAllParts());
    expect(board('esp32').placedPartIds).not.toContain('wire5v');
    expect(board('esp32').placedPartIds).toContain('espModule');
  });

  it('input toggles change the result (transistor signal)', async () => {
    store().selectBoard('transistor');
    await buildAndPower();
    expect(board('transistor').lastResult?.status).toBe('IDLE');   // signal is LOW
    store().toggleInput('signal');
    expect(board('transistor').lastResult?.status).toBe('RUNNING');
  });

  // These two exist in the base store only. If your IdeSlice replaced them, adapt or remove.
  it('uploadSketch needs power', async () => {
    store().selectBoard('uno');
    await finish(store().uploadSketch());
    expect(store().uploadedBoardIds).toEqual([]);
  });

  it('uploadSketch programs a powered board', async () => {
    store().selectBoard('uno');
    await buildAndPower();
    await finish(store().uploadSketch());
    expect(store().uploadedBoardIds).toContain('uno');
    expect(store().uploadProgress).toBeNull();
  });
});
