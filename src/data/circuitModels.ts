// ─────────────────────────────────────────────────────────────────────────────
// Value-aware physics for a board. The rules say WHICH parts must be present;
// these functions say what the chosen VALUES do, using real formulas (Ohm's law).
// They run only when every part is in place (the rules said RUNNING) and may
// override the result: dimmer light, an over-driven LED, a burned transistor...
// Each result carries `details`: the working shown in the "Live calculation" panel.
// ─────────────────────────────────────────────────────────────────────────────
import type {SimulationResult} from './types';
import {LED_TYPES, formatOhms} from './parameters';

type ValueOf = (partId: string) => number | string;
const fmt = (n: number) => n.toFixed(1);
const NONE = {litPartIds: [], blinkingPartIds: [], burnedPartIds: []};

/** Fig. 01: supply -> resistor -> LED.   I = (Vsupply - Vf) / R */
export function analyzeLedBoard(value: ValueOf): Partial<SimulationResult> {
  const supplyV = Number(value('power')), ohms = Number(value('resistor')), led = LED_TYPES[String(value('led'))];
  const milliamps = Math.max(0, (supplyV - led.forwardV) / ohms * 1000);
  const resistorWatts = (milliamps / 1000) ** 2 * ohms;           // P = I² × R
  const details = [
    `${supplyV} V supply, ${led.label} LED drops ${led.forwardV} V`,
    `I = (${supplyV} - ${led.forwardV}) / ${ohms} = ${fmt(milliamps)} mA`,
    `LED is rated ${led.maxMa} mA. Resistor heat = ${fmt(resistorWatts * 1000)} mW (rated 250 mW)`,
  ];
  if (supplyV <= led.forwardV) return {...NONE, status: 'IDLE', currentMilliamps: 0, details, brightness: {led: 0}, message: `${supplyV} V cannot light a ${led.label} LED: it needs more than ${led.forwardV} V.`};
  if (milliamps > led.maxMa * 1.5) return {...NONE, status: 'FAULT', currentMilliamps: Math.round(milliamps), burnedPartIds: ['led'], details, message: `${fmt(milliamps)} mA through a ${led.maxMa} mA LED. It burned out. Use a bigger resistor.`};
  if (resistorWatts > 0.25) return {...NONE, status: 'FAULT', currentMilliamps: Math.round(milliamps), burnedPartIds: ['resistor'], details, message: `The ${formatOhms(ohms)} resistor dissipates ${fmt(resistorWatts)} W, above its 0.25 W rating. It burned out.`};
  const brightness = Math.min(1.3, milliamps / led.maxMa);
  const message = milliamps > led.maxMa ? `${fmt(milliamps)} mA is above the ${led.maxMa} mA rating: very bright, but the LED will die early.`
    : milliamps < 1 ? `Only ${fmt(milliamps)} mA: the LED is barely visible. Try a smaller resistor.`
    : `${fmt(milliamps)} mA: a ${brightness > 0.6 ? 'bright' : 'dim'} ${led.label.toLowerCase()} light.`;
  return {...NONE, status: 'RUNNING', currentMilliamps: Math.round(milliamps), litPartIds: ['led'], details, message, brightness: {led: brightness}};
}

/** Fig. 02: a signal into the base switches the LED current.  Ib = (Vsig - 0.7) / Rb,  Ic(max) = gain × Ib */
export function analyzeTransistorBoard(value: ValueOf): Partial<SimulationResult> {
  const supplyV = Number(value('power')), baseOhms = Number(value('baseResistor')), loadOhms = Number(value('ledResistor'));
  const led = LED_TYPES[String(value('led'))];
  const SIGNAL_V = 5, BASE_DROP_V = 0.7, SATURATION_V = 0.2, GAIN = 100;   // typical 2N2222 numbers
  const baseMa = (SIGNAL_V - BASE_DROP_V) / baseOhms * 1000;
  const saturatedMa = Math.max(0, (supplyV - led.forwardV - SATURATION_V) / loadOhms * 1000); // what the LED path allows
  const gainLimitMa = GAIN * baseMa;                                                          // what the base can control
  const ledMa = Math.min(saturatedMa, gainLimitMa);
  const details = [
    `Base: Ib = (${SIGNAL_V} - ${BASE_DROP_V}) / ${baseOhms} = ${fmt(baseMa)} mA`,
    `LED path allows: (${supplyV} - ${led.forwardV} - ${SATURATION_V}) / ${loadOhms} = ${fmt(saturatedMa)} mA`,
    `Base controls up to: ${GAIN} × ${fmt(baseMa)} = ${fmt(gainLimitMa)} mA`,
  ];
  if (baseMa > 50) return {...NONE, status: 'FAULT', currentMilliamps: Math.round(baseMa), burnedPartIds: ['transistor'], details, message: `${fmt(baseMa)} mA into the base is far too much for a 2N2222. It burned out. Use a bigger base resistor.`};
  if (supplyV <= led.forwardV + SATURATION_V) return {...NONE, status: 'IDLE', currentMilliamps: Math.round(baseMa), details, message: `${supplyV} V is too low to light a ${led.label} LED through the transistor.`};
  if (ledMa > led.maxMa * 1.5) return {...NONE, status: 'FAULT', currentMilliamps: Math.round(ledMa), burnedPartIds: ['led'], details, message: `${fmt(ledMa)} mA through a ${led.maxMa} mA LED. It burned out. Use a bigger LED resistor.`};
  const isSaturated = gainLimitMa >= saturatedMa;
  return {
    ...NONE, status: 'RUNNING', currentMilliamps: Math.round(ledMa + baseMa), litPartIds: ['led'], details, brightness: {led: Math.min(1.3, ledMa / led.maxMa)},
    message: isSaturated ? `Saturated: the transistor is fully on and passes ${fmt(ledMa)} mA, controlled by just ${fmt(baseMa)} mA at the base.`
      : `Not saturated: the base only allows ${fmt(ledMa)} mA, so the LED is dim. Use a smaller base resistor.`,
  };
}
