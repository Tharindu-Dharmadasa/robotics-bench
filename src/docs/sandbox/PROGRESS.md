# Robotics Bench Sandbox — Progress Tracker

> Updated by the AI agent at the end of every task (see ANTIGRAVITY_GUIDE.md). Verify it yourself before committing.
> Status values: `Not started` · `In progress` · `Done` · `Blocked`

**Last updated:** _(date)_ **Branch:** `feature/sandbox`

---

## Building now

- **Task 0 — Repo audit** (Status: Not started)
  - Goal: read-only audit of the existing project before adding anything.
  - Files touched: none (only this file)
  - Notes:

## Next up

1. Task 1.1 — Dependencies, folders, ESLint import guards
2. Task 1.2a — `src/types/circuit.ts`
3. Task 1.2b — program/persistence types + engine interface

## Done

_(nothing yet)_

## Blocked / needs my input

_(nothing yet)_

---

## Full task list

### Phase 1 — Core types, pure solver, worker bridge

| ID   | Task                                              | Status      | Tests  | Notes |
| ---- | ------------------------------------------------- | ----------- | ------ | ----- |
| 0    | Repo audit (read-only)                            | Not started | n/a    |       |
| 1.1  | Deps, folders, ESLint import guards               | Not started |        |       |
| 1.2a | `types/circuit.ts`                                | Not started |        |       |
| 1.2b | `types/program.ts`, `types/persistence.ts`, `engineInterface.ts` | Not started | |  |
| 1.2c | `utils/breadboardGrid.ts`                         | Not started |        |       |
| 1.2d | `utils/manifestValidation.ts`, `test/fixtures.ts` | Not started |        |       |
| 1.3  | `unionFindNetlist.ts` (DSU nets + conductor graph) | Not started |       |       |
| 1.4  | `dcNodalSolver.ts` (criteria a–i)                 | Not started |        |       |
| 1.5a | `faultValidator.ts`                               | Not started |        |       |
| 1.5b | `behavioralEngine.ts` (tiers, fixed-step, lifecycle) | Not started |     |       |
| 1.6a | `worker.ts`, `engineClient.ts`                    | Not started |        |       |
| 1.6b | `telemetryStore.ts` + blink-LED integration test  | Not started |        |       |

**Phase 1 gate:** all Phase 1 tests green and I can explain commit → worker → frame flow. `[ ]`

### Phase 2 — Calibrator and vertical slice

| ID  | Task                                        | Status      | Notes |
| --- | ------------------------------------------- | ----------- | ----- |
| 2.0 | Asset intake (`.glb` files + `ASSETS.md`)   | Not started | I must supply the models |
| 2.1 | `PinCalibrator.tsx`                         | Not started |       |
| 2.2 | Vertical-slice manifests                    | Not started | Uno needs calibrated pins |

### Phase 3 — Workbench scene, wires, current flow

| ID   | Task                                         | Status      | Notes |
| ---- | -------------------------------------------- | ----------- | ----- |
| 3.1a | Stores + `engineBridge.ts`                   | Not started |       |
| 3.1b | `persistenceCodec.ts`                        | Not started |       |
| 3.2a | `SandboxCanvas.tsx`, `WorkbenchDesk.tsx`     | Not started |       |
| 3.2b | Breadboard snapping + occupancy preview      | Not started |       |
| 3.2c | `ComponentDrawer.tsx`, `PlacedModule.tsx` shell | Not started |    |
| 3.3  | Wire validation + `JumperWireLayer.tsx`      | Not started |       |
| 3.4  | `CurrentFlowOverlay.tsx`                     | Not started |       |

### Phase 4 — Hardware, VFX, HUD, sharing

| ID   | Task                                         | Status      | Notes |
| ---- | -------------------------------------------- | ----------- | ----- |
| 4.1a | H-bridge, ultrasonic, servo models (tests)   | Not started |       |
| 4.1b | Remaining component manifests                | Not started |       |
| 4.1c | Programs + manual pin driver UI              | Not started |       |
| 4.2a | Smoke VFX, scorch materials, reset button    | Not started |       |
| 4.2b | Probe/fault panel + share/export modal       | Not started |       |
| 4.2c | Frame-budget check + Playwright flows        | Not started |       |

---

## Repo audit (Task 0 fills this in)

_(React / R3F / TS / Vite versions, ESLint format, test setup, folder collisions, reusable Canvas, risks)_

## Decisions log

| Date | Decision | Why | Docs affected |
| ---- | -------- | --- | ------------- |
|      |          |     |               |

## Fixture constants (fill in during Task 1.2d, then treat as fixed)

| Constant                | Value |
| ----------------------- | ----- |
| LED `vf`                |       |
| LED `rdOhm`             |       |
| Supply `internalOhm`    | 0.1 Ω |
| GPIO `internalOhm`      | 25 Ω  |
| Pushbutton `contactOhm` |       |

## Measured performance (fill in during Task 4.2c)

| Metric                     | Target                  | Measured |
| -------------------------- | ----------------------- | -------- |
| Sim tick                   | ≤ 2 ms                  |          |
| FPS (12 comps, 60 wires)   | 60                      |          |
| Draw calls                 | documented ceiling: ___ |          |
| Geometry/material leaks    | 0                       |          |

## Open issues

- _(none)_
