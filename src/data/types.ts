// ─────────────────────────────────────────────────────────────────────────────
// All the "shapes" of data in the app. Read this file first: it is the
// vocabulary used by every other file.
// ─────────────────────────────────────────────────────────────────────────────

/** What the status panel shows. The first three are about building, the rest about running. */
export type BoardStatus = 'ASSEMBLING' | 'NEEDS SOLDER' | 'READY' | 'RUNNING' | 'IDLE' | 'FAULT' | 'DEAD';

/**
 * A tiny "condition language" so rules can be written as data instead of code.
 * Example: { allOf: [{ partPresent: 'led' }, { partMissing: 'resistor' }] }
 * means "the LED is on the board AND the resistor is not".
 */
export type Condition =
  | { partPresent: string }   // part is placed, soldered and not burned
  | { partMissing: string }   // the opposite of partPresent
  | { inputIsOn: string }     // a user toggle (e.g. "signal") is HIGH
  | { not: Condition }
  | { allOf: Condition[] }    // every condition is true (empty list = always true)
  | { anyOf: Condition[] };   // at least one condition is true

/** What a part looks like. Each kind has its own drawing code in render/PartShape.tsx. */
export type PartKind = 'resistor' | 'led' | 'chip' | 'capacitor' | 'header' | 'terminal' | 'heatsink' | 'relay' | 'motor' | 'connector' | 'eye' | 'block';

/** One physical component (resistor, LED, chip...) with its place on the board. */
export interface PartDefinition {
  id: string;            // unique inside a board, used by rules, e.g. "baseResistor"
  name: string;          // shown to the user
  description: string;   // one-line explanation of the part's job
  kind: PartKind;
  x: number; y: number;  // position on the board surface
  width: number; depth: number; height: number; // size of the 3D box we draw
  color: string;
  glowColor?: string;    // only for parts that emit light (LEDs)
  bands?: string[];      // resistor colour-band colours
  pinCount?: number;     // pins on a chip / header, screws on a terminal
  hasWindow?: boolean;   // draws a dark opening (USB ports)
  /** A "mistake" part (wrong wire, reversed supply...). "Place all" skips it: the user adds it on purpose to see what breaks. */
  isMistake?: boolean;
}

/** "If this condition matches, this is what happens." The FIRST matching rule wins. */
export interface FaultRule {
  condition: Condition;
  status: BoardStatus;
  message: string;                 // plain-English explanation of WHY
  currentMilliamps: number;        // fake current draw shown in the status panel
  litPartIds: string[];            // parts that glow
  blinkingPartIds: string[];       // parts that glow and blink
  burnedPartIds: string[];         // parts that are destroyed by this fault
}

/** What the engine returns: a rule without its condition. */
export type SimulationResult = Omit<FaultRule, 'condition'>;

/** A complete board: its parts, its rules, and its teaching text. */
export interface BoardDefinition {
  id: string;
  figureLabel: string;   // "Fig. 01"
  name: string;
  pcbColor: string;
  inputs?: { id: string; label: string }[];  // user toggles, e.g. a HIGH/LOW signal
  parts: PartDefinition[];
  rules: FaultRule[];
  lessonText: string;
  tryToBreakText: string;
}

/** The user's progress on ONE board. This is the only thing that changes while using the app. */
export interface BoardState {
  placedPartIds: string[];
  solderedPartIds: string[];
  burnedPartIds: string[];
  isPowered: boolean;
  inputValues: Record<string, boolean>;
  lastResult: SimulationResult | null;  // outcome of the latest power-on evaluation
}
