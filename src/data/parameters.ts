// ─────────────────────────────────────────────────────────────────────────────
// Adjustable parts. A part with a `parameter` can be given a value by the user
// (a resistance, an LED colour, a supply voltage). This file holds the tables
// of allowed values and the helpers that turn a chosen value into how the part
// looks (name, colour bands, LED colour).
// ─────────────────────────────────────────────────────────────────────────────
import type {PartDefinition} from './types';

/** Common resistor values (a subset of the E12 series). */
export const RESISTOR_OPTIONS = [10, 47, 100, 220, 330, 470, 1000, 2200, 4700, 10000, 100000];
export const SUPPLY_OPTIONS = [3.3, 5, 9, 12];

/** Real LED facts: forward voltage drop (Vf) and the rated current. Blue and white need more voltage than red. */
export const LED_TYPES: Record<string, {label: string; forwardV: number; maxMa: number; color: string; glow: string}> = {
  red: {label: 'Red', forwardV: 2.0, maxMa: 20, color: '#e04a3f', glow: '#ff5a4a'},
  green: {label: 'Green', forwardV: 2.2, maxMa: 20, color: '#3fae66', glow: '#7dff9e'},
  blue: {label: 'Blue', forwardV: 3.0, maxMa: 20, color: '#3a7bd5', glow: '#7ab8ff'},
  white: {label: 'White', forwardV: 3.2, maxMa: 20, color: '#e8e8e8', glow: '#ffffff'},
};

const trim = (n: number) => String(Math.round(n * 100) / 100);
/** 330 -> "330 Ω", 4700 -> "4.7 kΩ" */
export const formatOhms = (ohms: number) => ohms >= 1e6 ? `${trim(ohms / 1e6)} MΩ` : ohms >= 1000 ? `${trim(ohms / 1000)} kΩ` : `${trim(ohms)} Ω`;

export const formatCapacitance = (farads: number) =>
  farads >= 1e-3 ? `${trim(farads * 1e3)} mF` :
  farads >= 1e-6 ? `${trim(farads * 1e6)} µF` :
  farads >= 1e-9 ? `${trim(farads * 1e9)} nF` : `${trim(farads * 1e12)} pF`;

export const formatInductance = (henrys: number) =>
  henrys >= 1 ? `${trim(henrys)} H` :
  henrys >= 1e-3 ? `${trim(henrys * 1e3)} mH` : `${trim(henrys * 1e6)} µH`;

/** How an option is shown in a dropdown. */
export function formatOption(kind: string, option: number | string): string {
  if (kind === 'resistance') return formatOhms(Number(option));
  if (kind === 'supplyVoltage') return `${option} V`;
  if (kind === 'capacitance') return formatCapacitance(Number(option));
  if (kind === 'inductance') return formatInductance(Number(option));
  return LED_TYPES[String(option)]?.label ?? String(option);
}

// Resistor colour code: digit 0..7 -> colour.
const BAND_COLORS = ['#1a1a1a', '#7a4a1e', '#c62828', '#e07a1f', '#e6c619', '#2e8b57', '#2a5db0', '#7b3fa0'];

/** The three colour bands of a resistor: two digits and a multiplier. 330 -> orange, orange, brown. */
export function ohmsToBands(ohms: number): string[] {
  const exponent = Math.floor(Math.log10(ohms) + 1e-9);          // 330 -> 2
  const digits = Math.round(ohms / 10 ** (exponent - 1));        // two significant digits: 330 -> 33
  return [Math.floor(digits / 10), digits % 10, exponent - 1].map((index) => BAND_COLORS[index]);
}

/** The value the user chose for a part, or its default. */
export function getPartValue(board: {parts: PartDefinition[]}, partId: string, partValues?: Record<string, number | string>): number | string {
  return partValues?.[partId] ?? board.parts.find((part) => part.id === partId)?.parameter?.defaultValue ?? 0;
}

/** The part as it should LOOK with the chosen value applied (new name, colour bands or LED colour). */
export function getEffectivePart(part: PartDefinition, partValues?: Record<string, number | string>): PartDefinition {
  if (!part.parameter) return part;
  const value = partValues?.[part.id] ?? part.parameter.defaultValue;
  switch (part.parameter.kind) {
    case 'resistance': return {...part, name: `${formatOhms(Number(value))} resistor`, bands: ohmsToBands(Number(value))};
    case 'ledColor': { const led = LED_TYPES[String(value)]; return {...part, name: `${led.label} LED`, color: led.color, glowColor: led.glow}; }
    case 'supplyVoltage': return {...part, name: `${value} V header`};
    case 'capacitance': return {...part, name: `${formatCapacitance(Number(value))} capacitor`};
    case 'inductance': return {...part, name: `${formatInductance(Number(value))} inductor`};
    default: return part;
  }
}
