# Robotics Bench Sandbox — Antigravity Implementation Guide

How to build the Sandbox feature with Antigravity, one safe step at a time.
Companion files: `RULES.md`, `ARCHITECTURE.md`, `TASKS.md`, `PROGRESS.md`.

---

## 1. One-time setup (do this before Task 0)

1. Put the four docs in the repo at `src/docs/sandbox/` (`RULES.md`, `ARCHITECTURE.md`, `TASKS.md`, `PROGRESS.md`). Commit them.
2. Create a branch: `git checkout -b feature/sandbox`.
3. Make sure your baseline is green first: `npm run build` (and lint/tests if they exist). If the baseline is already red, fix or note it before starting, or you will not know who broke what.
4. Optional but recommended: add the workspace rule below so every Antigravity session loads it automatically. Antigravity reads workspace rules from `.agent/rules/`; if your version stores them elsewhere, paste the text into its Rules setting instead.

```md
<!-- .agent/rules/sandbox.md -->

# Sandbox feature rules

- Source of truth: src/docs/sandbox/ARCHITECTURE.md §5.6 (normative) > src/docs/sandbox/RULES.md > src/docs/sandbox/TASKS.md.
- If docs conflict or a detail is unspecified, STOP and ask. Never guess.
- Work on exactly one task per session. Do not start the next task.
- Write a plan first and wait for approval before editing files.
- Never edit a failing test to make it pass without explaining why the test was wrong and getting approval.
- Never import three/react/store/components/zustand/zundo/idb-keyval into src/types, src/registry, src/simulation (see RULES.md rule 8).
- Finish every task by running: npm run build && npm run lint && npm run typecheck && npm run test, then update src/docs/sandbox/PROGRESS.md.
```

---

## 2. The loop (repeat for every task)

1. **New chat/session per task.** Long sessions drift. A fresh session plus the master prompt is more reliable than a long one.
2. Paste the **Master Prompt** (below), then the **task prompt**.
3. Use Planning mode. **Read the plan before approving.** Check: right files, tests listed, nothing outside the task.
4. Let it implement. Don't interrupt unless it leaves scope.
5. **Run the checks yourself** in a terminal: `npm run build && npm run lint && npm run typecheck && npm run test`. Do not trust "all tests pass" in the chat.
6. Review the diff with the checklist in §4.
7. Confirm `PROGRESS.md` was updated (see §5), then `git commit -m "task 1.3: DSU net builder"`.
8. Only then move to the next task.

### Master Prompt (paste at the start of every session)

```text
You are implementing ONE task of the Robotics Bench Sandbox inside an EXISTING codebase.

Read first, in this order:
1. src/docs/sandbox/RULES.md
2. the sections of src/docs/sandbox/ARCHITECTURE.md that I name below
3. the task I name in src/docs/sandbox/TASKS.md
4. src/docs/sandbox/PROGRESS.md

Precedence if documents disagree: ARCHITECTURE §5.6 > RULES.md > TASKS.md.
If anything is ambiguous or unspecified, STOP and ask me. Do not guess.

Scope: only the task below. Do not modify unrelated existing code, do not install
packages not listed, do not begin the next task.

Process:
1. Write a short plan (files to create/change, tests to write, risks). Wait for my approval.
2. Where the task says Vitest, write the tests FIRST, then implement.
3. Implement.
4. Run npm run build, lint, typecheck, test and show me the real output.
5. Update src/docs/sandbox/PROGRESS.md: move the task, list files created, decisions made, open issues.
6. Summarize what changed and stop.

Never edit a failing test to make it pass unless you explain why the test was wrong and I approve.
```

---

## 3. Task prompts

Replace nothing in these; paste after the Master Prompt.

### Task 0 — Repo audit (read-only, do this first)

Why: this is an existing project. Before adding `src/types`, `src/store`, etc., you need to know what already exists so nothing collides.

```text
TASK 0: Read-only audit. Do NOT change any file except src/docs/sandbox/PROGRESS.md.
Report, under a "Repo audit" heading in PROGRESS.md:
- package.json: React, TypeScript, Vite, three, @react-three/fiber, @react-three/drei versions; existing scripts
- Is TypeScript strict? Path aliases (tsconfig/vite)?
- ESLint config format (flat eslint.config.* or .eslintrc) and current rules
- Test setup (vitest/jest present? config?)
- Existing folders that collide with: src/types, src/registry, src/simulation, src/store, src/utils, src/components/workbench|hud|devtools
- Any existing zustand/state usage and any existing R3F <Canvas> / OrbitControls setup I could reuse
- Anything in the existing app that conflicts with src/docs/sandbox/ARCHITECTURE.md §2 (React 19, R3F v9)
End with a list of risks and questions for me. Make no code changes.
```

Done when: the audit is in `PROGRESS.md` and you've answered its questions. If the project is not on React 19 / R3F v9, decide now whether to upgrade or adapt; don't let the agent decide.

---

## PHASE 1 — Core types, pure solver, worker bridge (Vitest first)

Phase 1 is pure TypeScript with no UI. It's the riskiest part (the solver), so it goes first and is tested hard. Expect most of your time here.

### Task 1.1 — Dependencies, folders, ESLint import guards

```text
TASK 1.1 (TASKS.md "Task 1.1"). Read RULES.md rule 8 and ARCHITECTURE §2 and §6.

Do:
- Install deps: zustand zundo immer comlink idb-keyval lz-string zod
  Dev deps: vitest fast-check (add only what is missing; keep existing versions of anything already installed)
- Create the folder skeleton from ARCHITECTURE §6 with a .gitkeep or index placeholder only (no logic).
- Configure ESLint using the project's existing config format:
  a) no-restricted-imports patterns: ban **/simulation/unionFindNetlist*, **/simulation/dcNodalSolver*,
     **/simulation/faultValidator*, **/simulation/behavioralEngine* inside src/components/**, src/store/**, src/utils/**
  b) ban imports of 'react' and 'three' inside src/types/**, src/registry/**, src/simulation/**,
     src/utils/breadboardGrid.ts, src/utils/manifestValidation.ts, src/utils/wireValidation.ts
  c) ban **/store/**, **/components/**, 'zustand', 'zundo', 'idb-keyval' inside src/types/**, src/registry/**, src/simulation/**
- PROVE the rules work: create temporary files that violate each rule, show that lint fails, then delete them.
- Add a vitest config (node environment) and a trivial passing test so `npx vitest --run` is green.
Do not write any simulation logic.
Done when: npm run build, lint, and `npx vitest --run` all pass, and you showed lint failing on the temporary violations.
```

### Task 1.2 — Core types, grid math, validation, fixtures (4 sessions)

TASKS.md bundles a lot into 1.2. Split it so each session is reviewable.

**1.2a — `src/types/circuit.ts`**

```text
TASK 1.2a. Read ARCHITECTURE §4.1 and §4.2 fully, and §5.6.4/§5.6.5 for constants.
Create src/types/circuit.ts containing exactly the types/constants specified there:
SafeId, PinAddress, PinRef, HoleCoord, BreadboardRegion, GridSpec, GpioPinMode, all PinDefinition
variants (discriminated union on `type`), ComponentElectricalModel (incl. POTENTIOMETER,
ACTUATOR_DC_MOTOR, ACTUATOR_MOTOR_DRIVER, SENSOR_ULTRASONIC), ComponentPlacement (DESK|BREADBOARD),
CircuitTopologySnapshot, CircuitFault, NetDescriptor, SimulationFrameOutput (both tagged with topologyEpoch),
CurrentFlowSegment, CurrentFlowDescriptor, TopologyDescriptor, COMPONENT_FLAG, FAULT_ORDER,
FAULT_PRECEDENCE_LEVEL, SHORT_OHM, MIN_OHM, GMIN, DEFAULT_I2T_FACTOR_S, DEFAULT_I2T_LIMIT_A2S.
Copy field names from the doc exactly. Do not invent fields. If the doc is missing a field you need, ask me.
No React/three imports. Add a type-level test file (expectTypeOf) for the discriminated unions.
Done when: build + lint + vitest pass.
```

**1.2b — program, persistence, engine interface**

```text
TASK 1.2b. Read ARCHITECTURE §4.3, §5.4, §5.6.10 and RULES rule 7.
Create:
- src/types/program.ts: ProgramMeta, ProgramPinRequirement, ManualPinOverride, ProgramRuntimeContext
  (runtime context exposes only readDigitalIn, readAnalogIn, pulseInUs, and write functions; PWM writes carry freqHz)
- src/types/persistence.ts: schemaVersion, calibratedModelVersion, zod schemas with .strict(),
  MAX_COMPONENTS=64, MAX_WIRES=256, MAX_COMPRESSED_CHARS=16000, MAX_JSON_CHARS=96000,
  ID regex /^[a-zA-Z0-9_-]+$/ on record keys, finite-number checks, wire color /^#[0-9a-fA-F]{6}$/, desk position within ±5 m
- src/simulation/engineInterface.ts: IWorkerSimulationEngine and IEngineClient exactly as in §5.4
Tests: zod accepts a valid minimal save; rejects unknown keys, NaN/Infinity, ':' in IDs, oversized arrays, bad color.
```

**1.2c — `src/utils/breadboardGrid.ts`**

```text
TASK 1.2c. Read ARCHITECTURE §5.5 and RULES rule 5. Pure functions only (no react/three).
Implement the single canonical converter: HoleCoord <-> PinAddress ("<boardId>:<region>:<col>:<row>")
<-> local 3D offset, for MAIN and TOP_POS/TOP_NEG/BOT_POS/BOT_NEG; bounds checks
(MAIN: col 0..cols-1, row 0..2*rowsPerSide-1; rails: col 0..railCols-1, row 0); strip membership
(MAIN strip = same col, same side of the centre gap; rail strip = same region, same railSegments segment);
quarterTurns rotation and rotated AABB math.
Tests (write first): round-trip for every hole of a 830-point spec; out-of-bounds rejected;
two holes in the same strip are members, different side of gap or different rail segment are not;
rotation by 0/90/180/270 gives correct AABB. Add a fast-check property test for the round-trip.
```

**1.2d — `manifestValidation.ts` + `src/test/fixtures.ts`**

```text
TASK 1.2d. Read ARCHITECTURE §4.1, §5.6.4 and TASKS Task 1.2.
Implement src/utils/manifestValidation.ts: ID regex, unique pin IDs, unit-length normals, pin positions inside
bounds, every model pin reference exists, all ohms/totalOhms/contactOhm finite and > 0, GridSpec railSegments sum to railCols,
and an `uncalibrated` option that skips calibration-only checks.
Implement src/test/fixtures.ts: small builders (makeResistor, makeLed, makeSupply5V, makeUnoLike, makePushbutton4Leg,
makePotentiometer, makeBreadboard) used by ALL later solver tests. Keep them minimal and documented with the numbers they use
(LED vf/rdOhm, GPIO internalOhm 25, supply internalOhm 0.1). Later tasks will depend on these numbers, so write them in a comment table.
Tests: each validation rule has a passing and a failing case.
```

### Task 1.3 — DSU net builder

```text
TASK 1.3. Read ARCHITECTURE §5.1 (Tier 1), §5.6.1, RULES rule 10 (first bullet).
Create src/simulation/unionFindNetlist.ts with pure buildNets():
- DSU over PinAddress keys, merging ONLY zero-resistance conductors: JumperWire endpoints, breadboard strips/rails
  (chained through occupied holes), internal pin groups (internalNetGroup), and breadboard-snapped component pins.
- SWITCH elements must NOT be merged; they become resistive edges (contactOhm) in the net graph. Two-terminal parts,
  loads, LEDs, sources, and potentiometer halves are also edges.
- Also return the conductor graph: one edge per wire and per breadboard strip (strip = chain through OCCUPIED holes in hole order), edges keep wire/strip IDs.
Tests first: multi-pin nets; open and closed switch yield identical DSU sets; rail/strip bridging; series and parallel edges;
conductor-graph fixtures preserve IDs; deterministic net ordering (netIndex stable for same input).
No solving here.
```

### Task 1.4 — Finite-resistance DC nodal solver (hardest task)

```text
TASK 1.4. Read ARCHITECTURE §5.2, §5.3, §5.6.1, §5.6.3, §5.6.4 and RULES rules 11 and 12 (resistance threshold part).
Create src/simulation/dcNodalSolver.ts: solveDcNetwork().
Suggested approach (confirm in your plan):
- Partition the net graph into connected islands per solve (open switches, Z pins, off LEDs split islands).
- Per island pick the reference net (lowest netIndex among GND-type/source-negative/MCU gnd nets) as 0 V. No reference => voltage = null for all nets in the island (flag in netFloatingMask), never NaN.
- Model sources and active GPIO pins as Norton/Thevenin with finite internalOhm. Clamp every resistive edge to MIN_OHM; open elements use GMIN.
- Build a small dense conductance matrix, solve with Gaussian elimination + partial pivoting (islands are tiny).
- LEDs: off (open) or on (vf + rdOhm). Iterate states up to 8 times; if the cap hits keep last states and set converged=false.
- Branch currents per component edge; then conductor-graph current distribution per §5.6.1 (BFS spanning tree, non-tree edges = 0 mA).
- Output CurrentFlowSegment[] (signed, from higher to lower potential).
Tests (write all first, these are the spec): (a) 5V->220Ω->LED->GND forward current + POWER direction, (b) reversed LED blocks,
(c) parallel LEDs different Vf, (d) two series resistors divide voltage, (e) floating island => null, no NaN,
(f) closed vs open pushbutton changes current without rebuilding DSU, (g) 3-pin net/two wires satisfies KCL at every node; loop net => 0 mA on non-tree edge,
(h) 5V->closed pushbutton->GND classified short via SHORT_OHM threshold, (i) potentiometer 0% and 100% finite, no NaN.
Add a fast-check property: for random resistor networks, no NaN/Infinity ever appears in outputs.
Do NOT implement faults here (that's 1.5).
```

### Task 1.5 — Fault validator and fixed-step engine (2 sessions)

**1.5a — `faultValidator.ts`**

```text
TASK 1.5a. Read ARCHITECTURE §5.2 (fault taxonomy), §5.6.2, §5.6.3, §5.6.5 and RULES rules 6, 12, 13, 14, 15.
Create src/simulation/faultValidator.ts: pure validate() taking solver output + latch sets, returning faults and updated latch sets.
Implement: DEAD_SHORT (DSU pre-check AND post-solve V/I <= SHORT_OHM while over rating), RAIL_CONTENTION, GPIO_CONTENTION, REVERSE_POLARITY (polarized !== false),
OVER_VOLTAGE (latch burnt, no flash), LED_OVERCURRENT, PIN_OVERCURRENT (MCU pin => damagedPinAddresses, pin becomes Z, instance flagged overloaded not burnt),
NO_COMMON_GROUND (device input reads Z), FLOATING_PIN (only inputs referenced by the active program, or SIGNAL_IN requiredDriven while powered).
Masking per FAULT_PRECEDENCE_LEVEL; ties by FAULT_ORDER, instanceId, pin address.
I²t accumulator exactly per §5.6.5: acc += max(0, I²-Imax²)*dt; recovery when I<=Imax; FLASHING 0.2 s sim time then BURNT.
Burnt electrical behavior table from §5.6.2.
Tests: TASKS Task 1.5 criteria (a),(b),(c),(d),(e),(f),(g),(i),(j),(l). In particular (l): 1 A pin at 2x rated burns in ~0.4 s of simulated time.
Keep latch sets as inputs/outputs, no hidden module state.
```

**1.5b — `behavioralEngine.ts`**

```text
TASK 1.5b. Read ARCHITECTURE §5.1 (all tiers), §5.6.7, §5.6.8 and RULES rules 10 and 19.
Create src/simulation/behavioralEngine.ts: BehavioralSimulationEngine.
- Pure synchronous step(dtSec) core. Fixed-step accumulator: FIXED_DT_SEC=1/60, MAX_SUBSTEPS=8.
- Timer wrapper (setInterval or MessageChannel, NEVER requestAnimationFrame): clamp raw dt <= 0.05, apply speed multiplier in {0.25,0.5,1,2}.
- Per-tick order EXACTLY: program/manual pins -> pin drive states -> solve -> sample inputs (1-tick latency) -> I²t and fault latching.
- Tier 1 loadTopology: rebuild nets, bump topologyEpoch, prune latches for removed instanceIds only. Tier 2 (setPower/setInputState/setManualPin/loadProgram): re-solve from cached graph, no DSU rebuild.
- setPower(true) resets program runtime and simTimeSec, keeps latches. setPower(false) zeroes nets, keeps latches. pause() freezes time only. Re-solve only when dirty.
- resetFaults(ids?) clears latches.
Tests: TASKS Task 1.5 criteria (h) and (k), plus: dt clamp, substep cap, speed multiplier, DSU not rebuilt on setInputState (spy on buildNets), latches survive loadTopology.
```

### Task 1.6 — Worker and EngineClient (2 sessions)

**1.6a — `worker.ts` + `engineClient.ts`**

```text
TASK 1.6a. Read ARCHITECTURE §5.4, §5.6.8, §5.6.9 and RULES rules 9 and 20.
Create src/simulation/worker.ts (Comlink.expose of the engine) and src/simulation/engineClient.ts.
EngineClient: wrap onFrame/onError listeners with Comlink.proxy; return SYNCHRONOUS unsubscribe functions;
if unsubscribe is called before the worker subscription id resolves, set a cancelled flag and unsubscribe when the id arrives;
release stored proxies on unsubscribe and dispose(); init() caches its promise; dispose() idempotent; module-singleton outside React;
setInputState latest-wins map keyed instanceId:controlId, flushed once per animation frame.
Frames sent with Comlink.transfer.
Tests use a real MessageChannel or the Comlink Node adapter (no mocks): proxied callbacks fire, unsubscribe-before-id, proxy release, idempotent init/dispose, TopologyDescriptor delivered once, coalescing.
```

**1.6b — `telemetryStore.ts` + headless integration**

```text
TASK 1.6b. Read ARCHITECTURE §2 (Transient Telemetry Store), §5.6.8.
Create src/store/telemetryStore.ts: non-reactive store (no React), keeps only the latest frame (Float32Array/Uint8Array),
drops frames whose topologyEpoch != active epoch, ring buffer for oscilloscope samples, listener set.
Then write the Phase 1 capstone test: headless blink-LED circuit through the REAL worker
(loadTopology -> loadProgram(blink) -> setPower(true) -> N ticks -> LED current toggles, no stale-epoch frame accepted).
If a blink program does not exist yet, use a minimal test-only program stub and note it in PROGRESS.md.
Done when: Phase 1 acceptance criteria in TASKS.md are all green.
```

**Phase 1 gate:** don't start Phase 2 until every Phase 1 test passes and you can explain, in your own words, how a topology commit flows to a frame. If you can't, ask Antigravity to walk you through it.

---

## PHASE 2 — Calibrator and vertical slice

> **You must do this by hand:** Task 2.0 needs real `.glb` files with licenses. The agent can't source them for you. Phase 3 can start with passives/breadboard only (they're procedural).

### Task 2.0 — Asset intake

```text
TASK 2.0. Read TASKS Task 2.0.
Create public/models/ASSETS.md (table: defId, source URL, license, author, triangle count, file size, budget).
Create a small script scripts/check-assets.ts (or vitest test) that fails if: a manifest modelUrl doesn't resolve to public/models/<defId>.glb,
an asset has no ASSETS.md row/license, or a file exceeds its size budget. Document a gltf-transform + meshopt command for compression.
Do not download assets. I will place the files.
```

### Task 2.1 — Pin calibrator dev tool

```text
TASK 2.1. Read ARCHITECTURE §4.1 (BasePinDefinition, modelScale) and §6.
Create src/components/devtools/PinCalibrator.tsx, reachable only in dev (e.g. route behind import.meta.env.DEV).
Features: load a .glb, raycast surface picking, snap-to-nearest-mesh-vertex, numeric X/Y/Z nudge inputs, normal vector editing,
modelScale preview, export PinDefinition[] as JSON and as TypeScript matching src/types/circuit.ts.
Verify the exported TS compiles (write a test that type-checks a sample export).
```

Do the calibrating yourself in the browser: pick each pin, nudge, export, paste into the manifest.

### Task 2.2 — Vertical-slice manifests

```text
TASK 2.2. Read ARCHITECTURE §4.1, §5.6.4 and TASKS Task 2.2.
Create in src/registry/components/: breadboard830.ts (procedural GridSpec, 2.54 mm pitch), dcSupply.ts, passives.ts
(220Ω, 1kΩ, LED, 4-leg pushbutton, potentiometer; pin positions procedural on 2.54 mm pitch),
and arduinoUno.ts (pins pasted from my calibrator export, which I'll provide).
No react/three imports. Add manifestValidation.test.ts that runs every manifest with uncalibrated=false.
Order: do breadboard/dcSupply/passives first; do arduinoUno only after I provide the calibrated pins.
```

---

## PHASE 3 — Workbench scene, wires, current flow

From here you must check results **in the browser**, not only in tests. Run `npm run dev` after each task and try it by hand.

### Task 3.1 — Stores, engine bridge, persistence (2 sessions)

**3.1a — stores + bridge**

```text
TASK 3.1a. Read RULES rules 4 and 5, ARCHITECTURE §2, §5.1, §5.6.9.
Create src/store/useSandboxStore.ts (zustand + immer + zundo; partialize ONLY { placedComponents, wires }),
src/store/draftStore.ts (drag positions, wire preview, powerEnabled, inputStates, manual GPIO pins),
src/store/engineBridge.ts (sends committed topology snapshots and control RPCs to EngineClient; latest-wins setInputState).
Commit to the sandbox store only on pointer-up / wire finalization. Deleting a breadboard detaches mounted parts to DESK and prunes invalid wires; no persisted snappedPinMap.
Tests: 100 simulated drag moves create 1 undo entry; potentiometer changes create 0; Undo/Redo triggers loadTopology with the restored snapshot; deleting a board detaches parts.
```

**3.1b — persistence codec**

```text
TASK 3.1b. Read RULES rule 7, ARCHITECTURE §5.6.10, src/types/persistence.ts.
Create src/utils/persistenceCodec.ts: schemaVersion + migrations, zod parse, check compressed length BEFORE decompress and JSON length AFTER,
validateTopologyIntegrity (defId, boardId, HoleCoord bounds via breadboardGrid, pinId), calibratedModelVersion drift warning, lz-string compressToEncodedURIComponent share URL in the hash.
Tests: reject unknown defId, bad boardId, out-of-bounds HoleCoord, unknown pinId, oversized payload, zip-bomb-style small compressed/huge decompressed.
Rejected input must never reach the store or the worker (assert with spies).
```

### Task 3.2 — Scene, snapping, drawer (3 sessions)

**3.2a — canvas + desk**

```text
TASK 3.2a. Read RULES rules 16-17, ARCHITECTURE §1 (Coordinate & Unit Convention), §6.
Create SandboxCanvas.tsx: standard 24-bit depth buffer (NO logarithmicDepthBuffer), camera.near=0.002, camera.far<=20, polygonOffset on coplanar surfaces,
hit/snap radii scaled by pitchMeters. WorkbenchDesk.tsx: desk surface, OrbitControls locked during drags, desk overlap prevention.
1 scene unit = 1 m; 1 mm = 0.001. Reuse the project's existing Canvas setup only if the audit says it's compatible.
Verify in browser: no clipping when zooming close to a breadboard.
```

**3.2b — breadboard snapping**

```text
TASK 3.2b. Read RULES rules 2 and 5, ARCHITECTURE §5.5.
Implement placement on DESK vs BREADBOARD (anchorHole, quarterTurns), R key rotates 90° steps, analytic hole hit-testing via breadboardGrid.ts (NO per-hole colliders),
green/red hole-occupancy ghost preview, moving a breadboard moves mounted parts, deleting detaches them.
Test pure logic with Vitest (snap math, occupancy); verify visuals by hand at 0° and 90° (pins align to holes, no z-fighting).
```

**3.2c — drawer + PlacedModule shell**

```text
TASK 3.2c. Read TASKS Task 3.2 (last sentence).
Create minimal ComponentDrawer.tsx (parts bin + POWER ON/OFF toggle) and PlacedModule.tsx shell (.glb load with modelScale; procedural passives fallback).
Keep the existing Robotics Bench look: blueprint panels, monospace indicators, FIG. XX headers, status badges (RULES rule 1).
Power toggle writes powerEnabled to draftStore only (not undoable).
```

### Task 3.3 — Wires

```text
TASK 3.3. Read RULES rule 16, ARCHITECTURE §5.5.
Create src/utils/wireValidation.ts (reject self-connection, duplicate wire, multiple leads in one breadboard hole) and src/utils/wireRouter.ts
(Bezier/catenary clearing rotated AABBs; THREE.TubeGeometry cached in Map<string, TubeGeometry> OUTSIDE Zustand; invalidated on topology commits),
and JumperWireLayer.tsx. During drags, attached wires are quadratic curves from draftStore; full route only on commit.
wireValidation.ts must not import three/react. Deleting a wire disposes only its own geometry.
Tests: validation rules (Vitest). Manual: click pin to pin, try invalid pairs, confirm clear error feedback.
```

### Task 3.4 — Current-flow overlay

```text
TASK 3.4. Read RULES rule 3, ARCHITECTURE §5.3.
Create CurrentFlowOverlay.tsx: ONE InstancedMesh of directional pulses along TopologyDescriptor.flows geometry, using flowCurrentsMa and flowRoles from telemetryStore per frame,
phase advanced by simTimeSec in useFrame, colors POWER amber, SIGNAL cyan, FAULT crimson. Frozen when powered off or paused. No per-frame React state updates.
Manual check: 5V -> 220Ω -> LED -> GND on a breadboard shows pulses source to ground; power off freezes them.
```

---

## PHASE 4 — Hardware, VFX, HUD, sharing

### Task 4.1 — Remaining hardware (3 sessions)

**4.1a — engine models (tests first)**

```text
TASK 4.1a. Read ARCHITECTURE §5.6.6, §5.2 (NO_COMMON_GROUND, FLOATING_PIN), RULES rule 18.
Implement in solver/engine: H-bridge (ACTUATOR_MOTOR_DRIVER) forward/reverse/brake motor current; ultrasonic echo (echoWidthUs = distanceCm*58, 0 outside range, requires trig HIGH >= 1 tick, only readable by pulseInUs on a wired pin);
servo angle from pulse width (1.0–2.0 ms maps to min..max angle; clamp outside 0.5–2.5 ms); PWM writes carry freqHz (default 1000, servo 50).
Tests per TASKS Task 4.1. Pause/speed values {0.25,0.5,1,2}.
```

**4.1b — manifests**

```text
TASK 4.1b. Create esp32S3.ts, sg90Servo.ts, l298nDriver.ts, dcMotor.ts, hcSr04Sensor.ts in src/registry/components/ (no react/three), pins from my calibrator exports.
All must pass manifestValidation with uncalibrated=false and the asset check from Task 2.0.
```

**4.1c — programs + manual pin driver UI**

```text
TASK 4.1c. Read ARCHITECTURE §4.3, §5.6.6, RULES rules 15 and 18.
Add ProgramMeta (with pinRequirements) in src/registry/programs/meta and worker runtimes in src/registry/programs/runtime for blink, servoSweep, motorControl, sonar.
Programs may ONLY use readDigitalIn, readAnalogIn, pulseInUs and write functions.
UI: Manual GPIO Pin Driver (ManualPinOverride; INPUT / INPUT_PULLUP / OUTPUT_DIGITAL / OUTPUT_PWM), read-only firmware snippet viewer, MCU pin wiring badges in PlacedModule/ComponentDrawer.
Tests: each program drives the expected outputs headlessly through the engine.
```

### Task 4.2 — VFX, diagnostics, export, perf (3 sessions)

**4.2a — burnout VFX + reset**

```text
TASK 4.2a. Read RULES rule 17, ARCHITECTURE §5.6.2.
SmokeParticleVFX.tsx (InstancedMesh), per-instance CLONED materials for scorch/glow in PlacedModule.tsx (never mutate shared cached .glb materials; dispose only dynamically created geometry/materials),
and a "Reset Faults / Burnt Parts" button calling resetFaults().
Manual check: 5V->LED->GND with no resistor burns the LED after ~0.2 s flash; reset restores it; Undo of a deletion restores an intact part.
```

**4.2b — probe/fault panel + share/export**

```text
TASK 4.2b. Read ARCHITECTURE §5.2 (fault list), §5.6.10.
ProbeAndFaultPanel.tsx (voltage + logic level readout, faults with actionable fix steps, oscilloscope from the ring buffer), ShareExportModal.tsx (BOM, pinout table, IndexedDB save/load via idb-keyval, share URL with .json fallback when too long).
Tests: BOM generation, save -> load round trip equals original, over-long link falls back to JSON export.
```

**4.2c — performance + Playwright**

```text
TASK 4.2c. Read TASKS Task 4.2 bullets 3-4.
Build a stress scene (~12 components, ~60 wires). Measure: sim tick <= 2 ms, 60 fps, draw calls under a documented ceiling (write the number in PROGRESS.md), zero geometry/material leaks via renderer.info after add/remove cycles.
Add Playwright flows: snap-to-breadboard, wire creation, power on/off, undo/redo.
Report real measured numbers, not estimates.
```

---

## 4. Review checklist (use after every task)

- [ ] Only files named in the plan changed. `git diff --stat` has no surprises.
- [ ] `npm run build && npm run lint && npm run typecheck && npm run test` pass **on your machine**.
- [ ] No `NaN`, `any`, `@ts-ignore`, or skipped/`.only` tests added.
- [ ] No banned imports (lint proves it). No `requestAnimationFrame` in `src/simulation/`.
- [ ] Names and constants match the docs (`SHORT_OHM`, `FIXED_DT_SEC`, `MAX_SUBSTEPS`, …), not renamed.
- [ ] Nothing the docs call "never persisted" (`burntInstanceIds`, `latchedOverloadIds`, `damagedPinAddresses`) leaked into saves.
- [ ] `PROGRESS.md` updated truthfully.

## 5. Keeping `PROGRESS.md` current

The Master Prompt makes the agent update it. Check it yourself every time. If a session ended abruptly, use:

```text
Update src/docs/sandbox/PROGRESS.md to match reality: run git status and git diff --stat, run the checks, then set each task's status
(Not started / In progress / Done / Blocked) and list what is actually finished vs. missing. Do not mark anything Done unless its acceptance criteria pass.
```

## 6. When things go wrong

- **Agent invents fields or renames types:** stop, point to the exact doc section, ask it to re-read and redo.
- **Test fails and the agent wants to change the test:** only allow it if the test contradicts the docs. Phase 1 tests are the spec.
- **Solver output wrong:** don't tweak constants. Reproduce with the smallest fixture first (e.g. one 5V source + one resistor + GND), verify by hand with Ohm's law, then grow.
- **Session got long and confused:** commit, open a new session, use the Master Prompt again.
- **Docs conflict:** decide yourself using the precedence order, write the decision in `PROGRESS.md` under "Decisions", then continue.

## 7. Notes from reading the docs

- TASKS bundles large tasks (1.2, 1.5, 1.6, 3.1, 3.2, 4.1, 4.2). This guide splits them; keep the splits.
- Fixture numbers (LED `vf`/`rdOhm`, GPIO `25 Ω`, supply `0.1 Ω`) must be chosen once in Task 1.2d and then never changed casually; every Phase 1 test depends on them.
- The acceptance criteria listed under Tasks 1.4 and 1.5 are your executable spec. Keep their letters (a, b, c…) in the test names so you can map test to requirement.
- Phase 2 Appendix A ports (`SimulationEnginePorts`) are explicitly **not** to be implemented.
