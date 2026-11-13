// ─────────────────────────────────────────────────────────────────────────────
// Modified Nodal Analysis (MNA) Engine.
// Solves node voltages, branch currents, component power dissipation, and checks
// for electrical failure thresholds (overpower, overcurrent, overvoltage).
// ─────────────────────────────────────────────────────────────────────────────

import { Matrix, solveLinearSystem } from "./matrix";
import type {
  BjtComponent,
  CircuitComponent,
  CircuitNetlist,
  ComponentFailure,
  ComponentOperatingPoint,
  DiodeComponent,
  MnaSimulationResult,
  ResistorComponent,
  VoltageSourceComponent,
} from "./types";

const MAX_ITERATIONS = 40;
const CONVERGENCE_TOLERANCE = 1e-4; // 0.1 mV
const MIN_CONDUCTANCE = 1e-12; // Gmin for numerical stability

export function solveCircuit(netlist: CircuitNetlist): MnaSimulationResult {
  const { groundNetId, components, nets } = netlist;

  // Build mapping from Pin string (e.g. "R1.pinA" or "V1.pinPos") to Net ID
  const pinToNetMap = new Map<string, string>();
  for (const net of nets) {
    for (const pin of net.pins) {
      pinToNetMap.set(pin, net.netId);
    }
  }

  const getPinNet = (componentId: string, pinName: string): string => {
    const qualified = `${componentId}.${pinName}`;
    return pinToNetMap.get(qualified) ?? pinToNetMap.get(pinName) ?? "GND";
  };

  // Collect all unique non-ground nets
  const nonGroundNets: string[] = [];
  const netIndices = new Map<string, number>();

  for (const net of nets) {
    if (net.netId !== groundNetId && !netIndices.has(net.netId)) {
      netIndices.set(net.netId, nonGroundNets.length + 1); // 1-based index
      nonGroundNets.push(net.netId);
    }
  }

  const numNodes = nonGroundNets.length;

  // Count independent voltage sources
  const voltageSources: VoltageSourceComponent[] = [];
  for (const comp of components) {
    if (comp.type === "voltage_source") {
      voltageSources.push(comp);
    }
  }

  const numVoltageSources = voltageSources.length;
  const matrixSize = numNodes + numVoltageSources;

  // Helper to map net ID to matrix index (0 for ground, 1..numNodes for normal nodes)
  const getNodeIndex = (netId: string): number => {
    if (netId === groundNetId) return 0;
    return netIndices.get(netId) ?? 0;
  };

  // Initial node voltage guesses (0V)
  let nodeVoltages = new Float64Array(numNodes + 1); // index 0 is ground (0V)

  // Track non-linear diodes/LEDs
  const diodes: DiodeComponent[] = [];
  const bjts: BjtComponent[] = [];
  for (const comp of components) {
    if (comp.type === "diode") diodes.push(comp);
    if (comp.type === "bjt") bjts.push(comp);
  }

  let converged = false;
  let iterations = 0;

  // Newton-Raphson iteration loop
  while (iterations < MAX_ITERATIONS && !converged) {
    iterations++;

    // System matrix A and RHS vector z
    const A = new Matrix(matrixSize, matrixSize);
    const z = new Float64Array(matrixSize);

    // Gmin stepping on diagonal for numerical stability
    for (let i = 0; i < numNodes; i++) {
      A.add(i, i, MIN_CONDUCTANCE);
    }

    // Helper to stamp conductance G between node n1 and n2
    const stampConductance = (net1: string, net2: string, g: number) => {
      const idx1 = getNodeIndex(net1);
      const idx2 = getNodeIndex(net2);

      if (idx1 > 0) A.add(idx1 - 1, idx1 - 1, g);
      if (idx2 > 0) A.add(idx2 - 1, idx2 - 1, g);
      if (idx1 > 0 && idx2 > 0) {
        A.add(idx1 - 1, idx2 - 1, -g);
        A.add(idx2 - 1, idx1 - 1, -g);
      }
    };

    // Helper to stamp current source into net1 (positive) and out of net2 (negative)
    const stampCurrent = (netIn: string, netOut: string, current: number) => {
      const idxIn = getNodeIndex(netIn);
      const idxOut = getNodeIndex(netOut);
      if (idxIn > 0) z[idxIn - 1] += current;
      if (idxOut > 0) z[idxOut - 1] -= current;
    };

    // Stamp linear passive elements
    for (const comp of components) {
      switch (comp.type) {
        case "resistor": {
          const netA = getPinNet(comp.id, comp.pinA);
          const netB = getPinNet(comp.id, comp.pinB);
          const g = 1 / Math.max(1e-9, comp.resistance);
          stampConductance(netA, netB, g);
          break;
        }
        case "capacitor": {
          const netA = getPinNet(comp.id, comp.pinA);
          const netB = getPinNet(comp.id, comp.pinB);
          // In DC steady-state, an ideal capacitor is an open circuit.
          // We include small parallel conductance (1e-11) or ESR if provided.
          const g = comp.esr ? 1 / comp.esr : 1e-11;
          stampConductance(netA, netB, g);
          break;
        }
        case "inductor": {
          const netA = getPinNet(comp.id, comp.pinA);
          const netB = getPinNet(comp.id, comp.pinB);
          // In DC steady-state, an ideal inductor is a short circuit (small series resistance)
          const r = Math.max(0.001, comp.seriesResistance ?? 0.01);
          stampConductance(netA, netB, 1 / r);
          break;
        }
        case "switch": {
          const netA = getPinNet(comp.id, comp.pinA);
          const netB = getPinNet(comp.id, comp.pinB);
          const r = comp.isClosed
            ? (comp.closedResistance ?? 0.001)
            : (comp.openResistance ?? 1e9);
          stampConductance(netA, netB, 1 / r);
          break;
        }
        case "current_source": {
          const netIn = getPinNet(comp.id, comp.pinIn);
          const netOut = getPinNet(comp.id, comp.pinOut);
          stampCurrent(netIn, netOut, comp.current);
          break;
        }
      }
    }

    // Stamp non-linear diodes (LEDs)
    for (const diode of diodes) {
      const netA = getPinNet(diode.id, diode.pinAnode);
      const netK = getPinNet(diode.id, diode.pinCathode);
      const vA = nodeVoltages[getNodeIndex(netA)];
      const vK = nodeVoltages[getNodeIndex(netK)];
      const vd = vA - vK;

      // Companion linearization for diode
      // If forward biased >= Vf: high conductance with voltage drop
      const vf = diode.forwardVoltage;
      const rDynamic = 0.5; // 0.5 ohm internal forward dynamic resistance

      if (vd >= vf) {
        const g = 1 / rDynamic;
        stampConductance(netA, netK, g);
        // Current offset: I = g*(vd - vf) => z_A gets -g*vf, z_K gets +g*vf
        const iEq = g * vf;
        const idxA = getNodeIndex(netA);
        const idxK = getNodeIndex(netK);
        if (idxA > 0) z[idxA - 1] += iEq;
        if (idxK > 0) z[idxK - 1] -= iEq;
      } else {
        // Reverse biased / off
        stampConductance(netA, netK, 1e-9);
      }
    }

    // Stamp BJTs (simplified active/saturation model)
    for (const bjt of bjts) {
      const netB = getPinNet(bjt.id, bjt.pinBase);
      const netC = getPinNet(bjt.id, bjt.pinCollector);
      const netE = getPinNet(bjt.id, bjt.pinEmitter);

      const vB = nodeVoltages[getNodeIndex(netB)];
      const vC = nodeVoltages[getNodeIndex(netC)];
      const vE = nodeVoltages[getNodeIndex(netE)];

      const vbe = vB - vE;
      const vce = vC - vE;
      const vbeDrop = bjt.vbeDrop ?? 0.7;

      if (vbe >= vbeDrop) {
        // Base-Emitter forward biased
        const rBase = 10; // small internal base resistance
        stampConductance(netB, netE, 1 / rBase);
        const idxB = getNodeIndex(netB);
        const idxE = getNodeIndex(netE);
        const iEq = (1 / rBase) * vbeDrop;
        if (idxB > 0) z[idxB - 1] += iEq;
        if (idxE > 0) z[idxE - 1] -= iEq;

        // Base current estimate
        const ib = Math.max(0, (vbe - vbeDrop) / rBase);
        const maxIc = bjt.beta * ib;

        if (vce > (bjt.vceSat ?? 0.2)) {
          // Forward active mode: controlled current source Ic = beta * Ib
          stampCurrent(netE, netC, maxIc);
        } else {
          // Saturation mode: low resistance Vce
          stampConductance(netC, netE, 1 / 0.2);
        }
      } else {
        // Cutoff mode
        stampConductance(netB, netE, 1e-9);
        stampConductance(netC, netE, 1e-9);
      }
    }

    // Stamp independent voltage sources (adds B, C, D blocks)
    voltageSources.forEach((vs, sIdx) => {
      const vsRow = numNodes + sIdx;
      const netPos = getPinNet(vs.id, vs.pinPos);
      const netNeg = getPinNet(vs.id, vs.pinNeg);

      const idxPos = getNodeIndex(netPos);
      const idxNeg = getNodeIndex(netNeg);

      if (idxPos > 0) {
        A.set(idxPos - 1, vsRow, 1);
        A.set(vsRow, idxPos - 1, 1);
      }
      if (idxNeg > 0) {
        A.set(idxNeg - 1, vsRow, -1);
        A.set(vsRow, idxNeg - 1, -1);
      }

      // Internal resistance if any (D block)
      if (vs.internalResistance && vs.internalResistance > 0) {
        A.set(vsRow, vsRow, -vs.internalResistance);
      }

      z[vsRow] = vs.voltage;
    });

    // Solve Ax = z
    const solution = solveLinearSystem(A, z);
    if (!solution) {
      // Numerical breakdown or floating node
      break;
    }

    // Check convergence
    let maxDiff = 0;
    const nextVoltages = new Float64Array(numNodes + 1);
    nextVoltages[0] = 0; // GND

    const isLinear = diodes.length === 0 && bjts.length === 0;

    for (let i = 0; i < numNodes; i++) {
      if (isLinear) {
        nextVoltages[i + 1] = solution[i];
      } else {
        const alpha = 0.7;
        nextVoltages[i + 1] = alpha * solution[i] + (1 - alpha) * nodeVoltages[i + 1];
      }
      const diff = Math.abs(nextVoltages[i + 1] - nodeVoltages[i + 1]);
      if (diff > maxDiff) maxDiff = diff;
    }

    nodeVoltages = nextVoltages;

    if (isLinear || maxDiff < CONVERGENCE_TOLERANCE) {
      converged = true;
    }
  }

  // Record final node voltages
  const resultMap: Record<string, number> = { [groundNetId]: 0 };
  nonGroundNets.forEach((netId, i) => {
    resultMap[netId] = Number(nodeVoltages[i + 1].toFixed(4));
  });

  // Calculate component operating points & check failure edge cases
  const componentStates: Record<string, ComponentOperatingPoint> = {};
  const failures: ComponentFailure[] = [];
  const details: string[] = [];

  for (const comp of components) {
    switch (comp.type) {
      case "resistor": {
        const netA = getPinNet(comp.id, comp.pinA);
        const netB = getPinNet(comp.id, comp.pinB);
        const vA = resultMap[netA] ?? 0;
        const vB = resultMap[netB] ?? 0;
        const vDrop = Math.abs(vA - vB);
        const current = vDrop / Math.max(1e-9, comp.resistance);
        const power = current * vDrop;

        componentStates[comp.id] = {
          componentId: comp.id,
          current,
          voltageDrop: vDrop,
          powerDissipated: power,
        };

        const maxW = comp.maxWatts ?? 0.25;
        if (power > maxW) {
          failures.push({
            componentId: comp.id,
            failureType: "OVERPOWER",
            message: `${comp.name} dissipated ${(power * 1000).toFixed(1)} mW, exceeding rated ${(maxW * 1000).toFixed(0)} mW. It burned out!`,
            measuredValue: power,
            ratedValue: maxW,
            unit: "W",
          });
        }

        details.push(
          `${comp.name} (${comp.resistance} Ω): V = ${vDrop.toFixed(2)} V, I = ${(current * 1000).toFixed(1)} mA, P = ${(power * 1000).toFixed(1)} mW (max ${maxW * 1000} mW)`,
        );
        break;
      }

      case "diode": {
        const netA = getPinNet(comp.id, comp.pinAnode);
        const netK = getPinNet(comp.id, comp.pinCathode);
        const vA = resultMap[netA] ?? 0;
        const vK = resultMap[netK] ?? 0;
        const vDrop = vA - vK;

        let current = 0;
        let brightness = 0;
        if (vDrop >= comp.forwardVoltage) {
          current = Math.max(0, (vDrop - comp.forwardVoltage) / 0.5);
          const maxMa = (comp.maxCurrentAmps ?? 0.02) * 1000;
          brightness = Math.min(1.5, (current * 1000) / maxMa);
        }

        componentStates[comp.id] = {
          componentId: comp.id,
          current,
          voltageDrop: vDrop,
          powerDissipated: current * vDrop,
          brightness,
          state: vDrop >= comp.forwardVoltage ? "CONDUCTING" : "OFF",
        };

        const maxA = comp.maxCurrentAmps ?? 0.02;
        if (current > maxA * 1.5) {
          failures.push({
            componentId: comp.id,
            failureType: "OVERCURRENT",
            message: `${comp.name} current ${(current * 1000).toFixed(1)} mA exceeded rating ${(maxA * 1000).toFixed(1)} mA. It burned out!`,
            measuredValue: current,
            ratedValue: maxA,
            unit: "A",
          });
        }

        if (vDrop < -(comp.maxReverseVoltage ?? 50)) {
          failures.push({
            componentId: comp.id,
            failureType: "REVERSE_POLARITY",
            message: `${comp.name} reverse voltage of ${Math.abs(vDrop).toFixed(1)} V exceeded breakdown limit.`,
            measuredValue: Math.abs(vDrop),
            ratedValue: comp.maxReverseVoltage ?? 50,
            unit: "V",
          });
        }

        details.push(
          `${comp.name} (Vf = ${comp.forwardVoltage} V): V_anode = ${vA.toFixed(2)} V, I = ${(current * 1000).toFixed(1)} mA, Brightness = ${(brightness * 100).toFixed(0)}%`,
        );
        break;
      }

      case "voltage_source": {
        const netPos = getPinNet(comp.id, comp.pinPos);
        const netNeg = getPinNet(comp.id, comp.pinNeg);
        const vPos = resultMap[netPos] ?? 0;
        const vNeg = resultMap[netNeg] ?? 0;

        componentStates[comp.id] = {
          componentId: comp.id,
          current: 0,
          voltageDrop: comp.voltage,
          powerDissipated: 0,
        };

        details.push(
          `${comp.name}: Supply = ${comp.voltage} V (${netPos} = ${vPos.toFixed(2)} V, ${netNeg} = ${vNeg.toFixed(2)} V)`,
        );
        break;
      }
    }
  }

  return {
    converged,
    iterations,
    nodeVoltages: resultMap,
    componentStates,
    failures,
    details,
  };
}
