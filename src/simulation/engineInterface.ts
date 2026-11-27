// ---------------------------------------------------------------------------
// src/simulation/engineInterface.ts — Worker & main-thread engine contracts
//
// Verbatim from ARCHITECTURE.md §5.4.
// ---------------------------------------------------------------------------

import type {
  CircuitTopologySnapshot,
  SafeId,
  SimulationFrameOutput,
  TopologyDescriptor,
} from "../types/circuit";
import type { ManualPinOverride } from "../types/program";

export interface IWorkerSimulationEngine {
  init(): Promise<void>;
  loadTopology(snapshot: CircuitTopologySnapshot): Promise<TopologyDescriptor>;
  loadProgram(programId: SafeId | null): Promise<void>;
  setPower(enabled: boolean): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  setSpeed(multiplier: number): Promise<void>;
  setInputState(
    instanceId: SafeId,
    controlId: SafeId,
    value: number | boolean,
  ): Promise<void>;
  setManualPin(override: ManualPinOverride): Promise<void>;
  resetFaults(instanceIds?: SafeId[]): Promise<void>;
  subscribeFrames(
    listener: (frame: SimulationFrameOutput) => void,
  ): Promise<number>;
  unsubscribeFrames(subscriptionId: number): Promise<void>;
  subscribeErrors(listener: (message: string) => void): Promise<number>;
  unsubscribeErrors(subscriptionId: number): Promise<void>;
  dispose(): Promise<void>;
}

// Main-thread facade: wraps callbacks in Comlink.proxy(), returns synchronous unsubscribe functions
export interface IEngineClient {
  init(): Promise<void>;
  loadTopology(snapshot: CircuitTopologySnapshot): Promise<TopologyDescriptor>;
  loadProgram(programId: SafeId | null): Promise<void>;
  setPower(enabled: boolean): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  setSpeed(multiplier: number): Promise<void>;
  setInputState(
    instanceId: SafeId,
    controlId: SafeId,
    value: number | boolean,
  ): Promise<void>;
  setManualPin(override: ManualPinOverride): Promise<void>;
  resetFaults(instanceIds?: SafeId[]): Promise<void>;
  onFrame(listener: (frame: SimulationFrameOutput) => void): () => void;
  onError(listener: (message: string) => void): () => void;
  dispose(): void;
}
