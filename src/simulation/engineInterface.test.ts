import { describe, it, expectTypeOf } from "vitest";
import type {
  IWorkerSimulationEngine,
  IEngineClient,
} from "./engineInterface";
import type { TopologyDescriptor } from "../types/circuit";

// ---------------------------------------------------------------------------
// (a) Callback & dispose return types
// ---------------------------------------------------------------------------
describe("(a) IEngineClient vs IWorkerSimulationEngine return types", () => {
  it("onFrame and onError return () => void; dispose returns void on client and Promise<void> on worker", () => {
    expectTypeOf<ReturnType<IEngineClient["onFrame"]>>().toEqualTypeOf<
      () => void
    >();
    expectTypeOf<ReturnType<IEngineClient["onError"]>>().toEqualTypeOf<
      () => void
    >();
    expectTypeOf<ReturnType<IEngineClient["dispose"]>>().toEqualTypeOf<void>();
    expectTypeOf<
      ReturnType<IWorkerSimulationEngine["dispose"]>
    >().toEqualTypeOf<Promise<void>>();
  });
});

// ---------------------------------------------------------------------------
// (b) Worker-only subscription methods
// ---------------------------------------------------------------------------
describe("(b) subscription methods", () => {
  it("IWorkerSimulationEngine has subscribe/unsubscribe methods; IEngineClient does not", () => {
    expectTypeOf<
      "subscribeFrames" extends keyof IWorkerSimulationEngine ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<
      "unsubscribeFrames" extends keyof IWorkerSimulationEngine ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<
      "subscribeErrors" extends keyof IWorkerSimulationEngine ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<
      "unsubscribeErrors" extends keyof IWorkerSimulationEngine ? true : false
    >().toEqualTypeOf<true>();

    expectTypeOf<
      "subscribeFrames" extends keyof IEngineClient ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "unsubscribeFrames" extends keyof IEngineClient ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "subscribeErrors" extends keyof IEngineClient ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "unsubscribeErrors" extends keyof IEngineClient ? true : false
    >().toEqualTypeOf<false>();
  });
});

// ---------------------------------------------------------------------------
// (c) Neither interface has a `step` member
// ---------------------------------------------------------------------------
describe("(c) no step member", () => {
  it("neither IWorkerSimulationEngine nor IEngineClient has step", () => {
    expectTypeOf<
      "step" extends keyof IWorkerSimulationEngine ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "step" extends keyof IEngineClient ? true : false
    >().toEqualTypeOf<false>();
  });
});

// ---------------------------------------------------------------------------
// (d) loadTopology resolves to TopologyDescriptor in both
// ---------------------------------------------------------------------------
describe("(d) loadTopology return type", () => {
  it("resolves to TopologyDescriptor in both interfaces", () => {
    expectTypeOf<
      ReturnType<IWorkerSimulationEngine["loadTopology"]>
    >().toEqualTypeOf<Promise<TopologyDescriptor>>();
    expectTypeOf<
      ReturnType<IEngineClient["loadTopology"]>
    >().toEqualTypeOf<Promise<TopologyDescriptor>>();
  });
});
