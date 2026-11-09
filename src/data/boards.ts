// ─────────────────────────────────────────────────────────────────────────────
// Board data. To add a board, add one object to BOARDS: no other file changes.
// Each board = parts (what you can place) + rules (what happens when powered).
// ─────────────────────────────────────────────────────────────────────────────
import type {BoardDefinition, Condition, FaultRule, PartDefinition} from './types';

/** Short helper to describe a part. Arguments: id, name, description, [x, y], [width, depth, height], colour, glow colour. */
const part = (
  id: string, name: string, description: string,
  [x, y]: [number, number], [width, depth, height]: [number, number, number],
  color: string, glowColor?: string,
): PartDefinition => ({id, name, description, x, y, width, depth, height, color, glowColor});

/** Short helper to describe a rule. `effects` lets a rule light, blink or burn parts. */
const rule = (
  condition: Condition, status: FaultRule['status'], message: string, currentMilliamps = 0,
  effects: Partial<Pick<FaultRule, 'litPartIds' | 'blinkingPartIds' | 'burnedPartIds'>> = {},
): FaultRule => ({condition, status, message, currentMilliamps, litPartIds: [], blinkingPartIds: [], burnedPartIds: [], ...effects});

// Condition shortcuts so rules read almost like sentences.
const present = (id: string): Condition => ({partPresent: id});
const missing = (id: string): Condition => ({partMissing: id});
const ALWAYS: Condition = {allOf: []}; // an empty "all of" is always true: used as the final "everything is fine" rule

export const BOARDS: BoardDefinition[] = [
  // ── Board 1: the simplest circuit ──────────────────────────────────────────
  {
    id: 'led', figureLabel: 'Fig. 01', name: 'LED + resistor', pcbColor: '#2f6b4f',
    lessonText: 'A power source, a current limiter and a light. The resistor decides how much current the LED sees.',
    tryToBreakText: 'Power it without the resistor, then replace the burnt LED and try again.',
    parts: [
      part('power', '5 V header', 'brings power in', [20, 50], [40, 44, 20], '#555555'),
      part('resistor', '330 Ω resistor', 'limits current', [105, 28], [54, 14, 9], '#d9b36c'),
      part('led', 'Red LED', 'the light (the load)', [170, 84], [24, 24, 16], '#e04a3f', '#ff5a4a'),
    ],
    // Rules are checked top to bottom; the first one that matches decides the outcome.
    rules: [
      rule(missing('power'), 'DEAD', 'No 5 V source on the board, so nothing is powered.'),
      rule(missing('led'), 'IDLE', 'The circuit is open: there is no LED to carry current.'),
      rule(missing('resistor'), 'FAULT', 'No current limiter! About 600 mA hit the LED and it burned out.', 600, {burnedPartIds: ['led']}),
      rule(ALWAYS, 'RUNNING', 'LED lit. The resistor limits current to about 14 mA.', 14, {litPartIds: ['led']}),
    ],
  },

  // ── Board 2: a transistor used as an electronic switch ─────────────────────
  {
    id: 'transistor', figureLabel: 'Fig. 02', name: 'Transistor switch', pcbColor: '#2f6b4f',
    inputs: [{id: 'signal', label: 'Signal'}], // adds a HIGH/LOW button to the controls
    lessonText: 'A tiny base current lets a transistor switch a bigger load current, the way a microcontroller pin drives bigger loads.',
    tryToBreakText: 'Set the signal HIGH with no base resistor, or remove the LED resistor.',
    parts: [
      part('power', '5 V header', 'brings power in', [14, 10], [36, 36, 18], '#555555'),
      part('baseResistor', '1 kΩ base resistor', 'protects the transistor base', [70, 30], [44, 12, 8], '#d9b36c'),
      part('transistor', '2N2222 NPN', 'the switch', [130, 22], [26, 20, 16], '#2b2b2b'),
      part('ledResistor', '330 Ω resistor', 'limits LED current', [75, 80], [44, 12, 8], '#d9b36c'),
      part('led', 'Green LED', 'the light (the load)', [170, 90], [24, 24, 16], '#3fae66', '#7dff9e'),
    ],
    rules: [
      rule(missing('power'), 'DEAD', 'No 5 V source on the board.'),
      rule(missing('transistor'), 'IDLE', 'No transistor, so nothing can switch the LED.'),
      rule({not: {inputIsOn: 'signal'}}, 'IDLE', 'Signal is LOW: the transistor is off. Set the signal HIGH.', 1),
      rule(missing('baseResistor'), 'FAULT', 'No base resistor: the base was over-driven and the transistor died.', 300, {burnedPartIds: ['transistor']}),
      rule(missing('led'), 'IDLE', 'Open load: there is no LED in the path.', 2),
      rule(missing('ledResistor'), 'FAULT', 'No series resistor on the LED, so it burned out.', 500, {burnedPartIds: ['led']}),
      rule(ALWAYS, 'RUNNING', 'About 4 mA of base current switches about 16 mA through the LED.', 20, {litPartIds: ['led']}),
    ],
  },

  // ── Board 3: a real microcontroller board ──────────────────────────────────
  {
    id: 'uno', figureLabel: 'Fig. 03', name: 'Arduino Uno R3', pcbColor: '#2b5aa8',
    lessonText: 'An ATmega328P needs power, a clean 5 V rail and a 16 MHz clock before it runs your sketch. Pin 13 drives an LED.',
    tryToBreakText: 'Remove the crystal or the regulator, then power up. Try the LED without its resistor.',
    parts: [
      part('usbPort', 'USB-B connector', 'power and serial', [10, 10], [44, 40, 22], '#aaaaaa'),
      part('regulator', '5 V regulator', 'makes a clean 5 V rail', [70, 12], [26, 22, 14], '#2b2b2b'),
      part('crystal', '16 MHz crystal', 'the clock', [75, 60], [34, 16, 12], '#c0c0c8'),
      part('microcontroller', 'ATmega328P', 'the brain', [130, 40], [70, 28, 12], '#222222'),
      part('decouplingCap', '100 nF capacitor', 'filters supply noise', [70, 105], [20, 14, 12], '#d6a228'),
      part('pin13Resistor', 'Pin 13 resistor', 'limits LED current', [130, 100], [36, 12, 8], '#d9b36c'),
      part('pin13Led', 'Pin 13 LED', 'blink output', [185, 100], [24, 20, 12], '#f0a020', '#ffc04a'),
    ],
    rules: [
      rule(missing('usbPort'), 'DEAD', 'No USB power.'),
      rule(missing('regulator'), 'DEAD', 'No 5 V regulator, so there is no stable supply rail.'),
      rule(missing('microcontroller'), 'IDLE', 'Power is fine but there is no ATmega328P to run code.', 5),
      rule(missing('crystal'), 'FAULT', 'No 16 MHz crystal: the chip never starts executing.', 22),
      rule({allOf: [present('pin13Led'), missing('pin13Resistor')]}, 'FAULT', 'Pin 13 drove the LED with no resistor. The LED burned out.', 90, {burnedPartIds: ['pin13Led']}),
      rule({anyOf: [missing('pin13Led'), missing('pin13Resistor')]}, 'RUNNING', 'Code runs, but pin 13 shows nothing. Add its resistor and LED.', 45),
      rule(missing('decouplingCap'), 'RUNNING', 'Blinks, but with no decoupling cap the supply is noisy and may reset.', 48, {blinkingPartIds: ['pin13Led']}),
      rule(ALWAYS, 'RUNNING', 'Blink sketch running: pin 13 toggles once a second.', 45, {blinkingPartIds: ['pin13Led']}),
    ],
  },
];

/** Look a board up by id, e.g. BOARDS_BY_ID['led']. */
export const BOARDS_BY_ID = Object.fromEntries(BOARDS.map((board) => [board.id, board])) as Record<string, BoardDefinition>;
