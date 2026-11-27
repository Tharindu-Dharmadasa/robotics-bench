import { describe, it, expect, expectTypeOf } from "vitest";
import {
  DEFAULT_I2T_FACTOR_S,
  DEFAULT_I2T_LIMIT_A2S,
  SHORT_OHM,
  MIN_OHM,
  GMIN,
  COMPONENT_FLAG,
  FAULT_ORDER,
  FAULT_PRECEDENCE_LEVEL,
} from "./circuit";
import type {
  PinDefinition,
  ComponentElectricalModel,
  ComponentPlacement,
  PinRef,
  CircuitFaultKind,
  NetDescriptor,
  SimulationFrameOutput,
  GpioPinMode,
  SafeId,
  HoleCoord,
} from "./circuit";

// ---------------------------------------------------------------------------
// (a) Constants have exact doc values
// ---------------------------------------------------------------------------
describe("(a) constants have exact doc values", () => {
  it("DEFAULT_I2T_FACTOR_S === 1.2", () => {
    expect(DEFAULT_I2T_FACTOR_S).toBe(1.2);
  });

  it("DEFAULT_I2T_LIMIT_A2S === 0.0005", () => {
    expect(DEFAULT_I2T_LIMIT_A2S).toBe(0.0005);
  });

  it("SHORT_OHM === 1", () => {
    expect(SHORT_OHM).toBe(1);
  });

  it("MIN_OHM === 1e-3", () => {
    expect(MIN_OHM).toBe(1e-3);
  });

  it("GMIN === 1e-9", () => {
    expect(GMIN).toBe(1e-9);
  });

  it("COMPONENT_FLAG has exact bit values", () => {
    expect(COMPONENT_FLAG.BURNT).toBe(1);
    expect(COMPONENT_FLAG.OVERLOADED).toBe(2);
    expect(COMPONENT_FLAG.FLASHING).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// (b) FAULT_ORDER has exactly 9 entries in exact doc order, no duplicates
// ---------------------------------------------------------------------------
describe("(b) FAULT_ORDER", () => {
  it("has exactly 9 entries", () => {
    expect(FAULT_ORDER).toHaveLength(9);
  });

  it("is in the exact doc order", () => {
    expect([...FAULT_ORDER]).toEqual([
      "DEAD_SHORT",
      "RAIL_CONTENTION",
      "GPIO_CONTENTION",
      "REVERSE_POLARITY",
      "OVER_VOLTAGE",
      "LED_OVERCURRENT",
      "PIN_OVERCURRENT",
      "NO_COMMON_GROUND",
      "FLOATING_PIN",
    ]);
  });

  it("has no duplicates", () => {
    const set = new Set(FAULT_ORDER);
    expect(set.size).toBe(FAULT_ORDER.length);
  });
});

// ---------------------------------------------------------------------------
// (c) FAULT_PRECEDENCE_LEVEL has a key for every FAULT_ORDER entry and no
//     extra keys, with exact levels
// ---------------------------------------------------------------------------
describe("(c) FAULT_PRECEDENCE_LEVEL", () => {
  it("has a key for every FAULT_ORDER entry and no extras", () => {
    const keys = Object.keys(FAULT_PRECEDENCE_LEVEL).sort();
    const faultOrderSorted = [...FAULT_ORDER].sort();
    expect(keys).toEqual(faultOrderSorted);
  });

  it("has exact precedence levels", () => {
    expect(FAULT_PRECEDENCE_LEVEL.DEAD_SHORT).toBe(0);
    expect(FAULT_PRECEDENCE_LEVEL.RAIL_CONTENTION).toBe(1);
    expect(FAULT_PRECEDENCE_LEVEL.GPIO_CONTENTION).toBe(1);
    expect(FAULT_PRECEDENCE_LEVEL.REVERSE_POLARITY).toBe(1);
    expect(FAULT_PRECEDENCE_LEVEL.OVER_VOLTAGE).toBe(2);
    expect(FAULT_PRECEDENCE_LEVEL.LED_OVERCURRENT).toBe(3);
    expect(FAULT_PRECEDENCE_LEVEL.PIN_OVERCURRENT).toBe(3);
    expect(FAULT_PRECEDENCE_LEVEL.NO_COMMON_GROUND).toBe(4);
    expect(FAULT_PRECEDENCE_LEVEL.FLOATING_PIN).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// (d) PinDefinition narrows correctly on `type`
// ---------------------------------------------------------------------------
describe("(d) PinDefinition type-level narrowing", () => {
  it("GPIO exposes allowedModes, defaultMode, internalOhm", () => {
    type GpioDef = Extract<PinDefinition, { type: "GPIO" }>;
    expectTypeOf<GpioDef["allowedModes"]>().toEqualTypeOf<GpioPinMode[]>();
    expectTypeOf<GpioDef["defaultMode"]>().toEqualTypeOf<GpioPinMode>();
    expectTypeOf<GpioDef["internalOhm"]>().toEqualTypeOf<number>();
  });

  it("PASSIVE has no maxCurrentMa", () => {
    type PassiveDef = Extract<PinDefinition, { type: "PASSIVE" }>;
    expectTypeOf<PassiveDef>().not.toHaveProperty("maxCurrentMa");
  });
});

// ---------------------------------------------------------------------------
// (e) ComponentElectricalModel narrows correctly on `kind`
// ---------------------------------------------------------------------------
describe("(e) ComponentElectricalModel type-level narrowing", () => {
  it("LED exposes anodePinId, cathodePinId, vf, imaxMa, rdOhm", () => {
    type LedModel = Extract<ComponentElectricalModel, { kind: "LED" }>;
    expectTypeOf<LedModel["anodePinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<LedModel["cathodePinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<LedModel["vf"]>().toEqualTypeOf<number>();
    expectTypeOf<LedModel["imaxMa"]>().toEqualTypeOf<number>();
    expectTypeOf<LedModel["rdOhm"]>().toEqualTypeOf<number>();
  });

  it("SWITCH exposes pinA, pinB, contactOhm, normallyClosed?", () => {
    type SwitchModel = Extract<ComponentElectricalModel, { kind: "SWITCH" }>;
    expectTypeOf<SwitchModel["pinA"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<SwitchModel["pinB"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<SwitchModel["contactOhm"]>().toEqualTypeOf<number>();
    expectTypeOf<SwitchModel["normallyClosed"]>().toEqualTypeOf<
      boolean | undefined
    >();
  });

  it("POTENTIOMETER exposes pinA, wiperPinId, pinB, totalOhms", () => {
    type PotModel = Extract<
      ComponentElectricalModel,
      { kind: "POTENTIOMETER" }
    >;
    expectTypeOf<PotModel["pinA"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<PotModel["wiperPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<PotModel["pinB"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<PotModel["totalOhms"]>().toEqualTypeOf<number>();
  });

  it("ACTUATOR_MOTOR_DRIVER exposes full H-bridge pin mapping", () => {
    type DriverModel = Extract<
      ComponentElectricalModel,
      { kind: "ACTUATOR_MOTOR_DRIVER" }
    >;
    expectTypeOf<DriverModel["in1PinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<DriverModel["in2PinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<DriverModel["out1APinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<DriverModel["out1BPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<DriverModel["supplyPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<DriverModel["gndPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<DriverModel["maxSupplyV"]>().toEqualTypeOf<number>();
    expectTypeOf<DriverModel["dropoutV"]>().toEqualTypeOf<number>();
    expectTypeOf<DriverModel["maxChannelMa"]>().toEqualTypeOf<number>();
    expectTypeOf<DriverModel["loadOhm"]>().toEqualTypeOf<number>();
    // Optional pins
    expectTypeOf<DriverModel["enaPinId"]>().toEqualTypeOf<
      SafeId | undefined
    >();
    expectTypeOf<DriverModel["in3PinId"]>().toEqualTypeOf<
      SafeId | undefined
    >();
    expectTypeOf<DriverModel["in4PinId"]>().toEqualTypeOf<
      SafeId | undefined
    >();
    expectTypeOf<DriverModel["enbPinId"]>().toEqualTypeOf<
      SafeId | undefined
    >();
    expectTypeOf<DriverModel["out2APinId"]>().toEqualTypeOf<
      SafeId | undefined
    >();
    expectTypeOf<DriverModel["out2BPinId"]>().toEqualTypeOf<
      SafeId | undefined
    >();
    expectTypeOf<DriverModel["logicSupplyPinId"]>().toEqualTypeOf<
      SafeId | undefined
    >();
    expectTypeOf<DriverModel["i2tLimitA2s"]>().toEqualTypeOf<
      number | undefined
    >();
  });

  it("SENSOR_ULTRASONIC exposes range and echo fields", () => {
    type UltrasonicModel = Extract<
      ComponentElectricalModel,
      { kind: "SENSOR_ULTRASONIC" }
    >;
    expectTypeOf<UltrasonicModel["trigPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<UltrasonicModel["echoPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<UltrasonicModel["vccPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<UltrasonicModel["gndPinId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<UltrasonicModel["nominalV"]>().toEqualTypeOf<number>();
    expectTypeOf<UltrasonicModel["loadOhm"]>().toEqualTypeOf<number>();
    expectTypeOf<UltrasonicModel["maxMa"]>().toEqualTypeOf<number>();
    expectTypeOf<UltrasonicModel["minRangeCm"]>().toEqualTypeOf<number>();
    expectTypeOf<UltrasonicModel["maxRangeCm"]>().toEqualTypeOf<number>();
    expectTypeOf<UltrasonicModel["defaultDistanceCm"]>().toEqualTypeOf<number>();
  });
});

// ---------------------------------------------------------------------------
// (f) ComponentPlacement narrows on `kind`
// ---------------------------------------------------------------------------
describe("(f) ComponentPlacement type-level narrowing", () => {
  it("DESK has position and yawRad", () => {
    type DeskPlacement = Extract<ComponentPlacement, { kind: "DESK" }>;
    expectTypeOf<DeskPlacement["position"]>().toEqualTypeOf<
      [number, number, number]
    >();
    expectTypeOf<DeskPlacement["yawRad"]>().toEqualTypeOf<number>();
  });

  it("BREADBOARD has boardId, anchorHole, quarterTurns: 0|1|2|3", () => {
    type BbPlacement = Extract<ComponentPlacement, { kind: "BREADBOARD" }>;
    expectTypeOf<BbPlacement["boardId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<BbPlacement["anchorHole"]>().toEqualTypeOf<HoleCoord>();
    expectTypeOf<BbPlacement["quarterTurns"]>().toEqualTypeOf<0 | 1 | 2 | 3>();
  });
});

// ---------------------------------------------------------------------------
// (g) PinRef narrows on `kind`; CircuitFaultKind = union of FAULT_ORDER
// ---------------------------------------------------------------------------
describe("(g) PinRef and CircuitFaultKind type-level checks", () => {
  it('PinRef narrows on kind: "PIN" has instanceId and pinId', () => {
    type PinRefPin = Extract<PinRef, { kind: "PIN" }>;
    expectTypeOf<PinRefPin["instanceId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<PinRefPin["pinId"]>().toEqualTypeOf<SafeId>();
  });

  it('PinRef narrows on kind: "HOLE" has boardId and hole', () => {
    type PinRefHole = Extract<PinRef, { kind: "HOLE" }>;
    expectTypeOf<PinRefHole["boardId"]>().toEqualTypeOf<SafeId>();
    expectTypeOf<PinRefHole["hole"]>().toEqualTypeOf<HoleCoord>();
  });

  it("CircuitFaultKind equals the union of FAULT_ORDER entries", () => {
    expectTypeOf<CircuitFaultKind>().toEqualTypeOf<
      (typeof FAULT_ORDER)[number]
    >();
  });
});

// ---------------------------------------------------------------------------
// (h) NetDescriptor and SimulationFrameOutput have topologyEpoch: number;
//     netVoltages is Float32Array, netFloatingMask is Uint8Array
// ---------------------------------------------------------------------------
describe("(h) NetDescriptor and SimulationFrameOutput type-level checks", () => {
  it("NetDescriptor has topologyEpoch: number", () => {
    expectTypeOf<NetDescriptor["topologyEpoch"]>().toEqualTypeOf<number>();
  });

  it("SimulationFrameOutput has topologyEpoch: number", () => {
    expectTypeOf<
      SimulationFrameOutput["topologyEpoch"]
    >().toEqualTypeOf<number>();
  });

  it("SimulationFrameOutput.netVoltages is Float32Array", () => {
    expectTypeOf<
      SimulationFrameOutput["netVoltages"]
    >().toEqualTypeOf<Float32Array>();
  });

  it("SimulationFrameOutput.netFloatingMask is Uint8Array", () => {
    expectTypeOf<
      SimulationFrameOutput["netFloatingMask"]
    >().toEqualTypeOf<Uint8Array>();
  });
});
