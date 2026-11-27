import { describe, it, expectTypeOf } from "vitest";
import type {
  ProgramPinDirection,
  ProgramPinRequirement,
  ProgramMeta,
  ManualPinOverride,
  ProgramRuntimeContext,
} from "./program";
import type { GpioPinMode, PinAddress, SafeId } from "./circuit";

// ---------------------------------------------------------------------------
// (a) keyof ProgramRuntimeContext equals exactly the 8 allowed members
// ---------------------------------------------------------------------------
describe("(a) ProgramRuntimeContext keys", () => {
  it("exposes exactly the 8 allowed members and nothing else", () => {
    expectTypeOf<keyof ProgramRuntimeContext>().toEqualTypeOf<
      | "simTimeSec"
      | "tickCount"
      | "readDigitalIn"
      | "readAnalogIn"
      | "writePinMode"
      | "writeDigitalOut"
      | "writePwmOut"
      | "pulseInUs_BROKEN"
    >();
  });
});

// ---------------------------------------------------------------------------
// (b) writePwmOut accepts an optional third argument freqHz
// ---------------------------------------------------------------------------
describe("(b) writePwmOut signature", () => {
  it("accepts (addr, duty01, freqHz?) => void", () => {
    expectTypeOf<ProgramRuntimeContext["writePwmOut"]>().toEqualTypeOf<
      (addr: PinAddress, duty01: number, freqHz?: number) => void
    >();
  });
});

// ---------------------------------------------------------------------------
// (c) ManualPinOverride shape
// ---------------------------------------------------------------------------
describe("(c) ManualPinOverride", () => {
  it("has pinAddress, mode (GpioPinMode), digitalHigh, pwmDuty, optional freqHz, active", () => {
    expectTypeOf<ManualPinOverride["pinAddress"]>().toEqualTypeOf<PinAddress>();
    expectTypeOf<ManualPinOverride["mode"]>().toEqualTypeOf<GpioPinMode>();
    expectTypeOf<ManualPinOverride["digitalHigh"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ManualPinOverride["pwmDuty"]>().toEqualTypeOf<number>();
    expectTypeOf<ManualPinOverride["freqHz"]>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<ManualPinOverride["active"]>().toEqualTypeOf<boolean>();
  });
});

// ---------------------------------------------------------------------------
// (d) ProgramMeta.pinRequirements is ProgramPinRequirement[]
// ---------------------------------------------------------------------------
describe("(d) ProgramMeta.pinRequirements", () => {
  it("is ProgramPinRequirement[]", () => {
    expectTypeOf<ProgramMeta["pinRequirements"]>().toEqualTypeOf<
      ProgramPinRequirement[]
    >();
    expectTypeOf<ProgramPinRequirement["direction"]>().toEqualTypeOf<
      ProgramPinDirection
    >();
    expectTypeOf<ProgramPinRequirement["role"]>().toEqualTypeOf<SafeId>();
  });
});
