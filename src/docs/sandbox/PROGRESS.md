# Robotics Bench Sandbox — Progress Tracker

> Updated by the AI agent at the end of every task (see ANTIGRAVITY_GUIDE.md). Verify it yourself before committing.
> Status values: `Not started` · `In progress` · `Done` · `Blocked`

**Last updated:** 2026-11-27 **Branch:** `feature/sandbox`

---

## Building now

Task 1.2b — `src/types/program.ts`, `src/types/persistence.ts`, `src/simulation/engineInterface.ts`

## Next up

1. Task 1.2b — program/persistence types + engine interface
2. Task 1.2c — `src/utils/breadboardGrid.ts`
3. Task 1.2d — `src/utils/manifestValidation.ts`, `src/test/fixtures.ts`

## Done

- **Task 0 — Repo audit** (Status: Done)
  - Goal: read-only audit of the existing project before adding anything.
  - Files touched: `src/docs/sandbox/PROGRESS.md` only.
  - Notes: See "Repo audit" section below.
- **Task 1.1 — Dependencies, folders, ESLint import guards** (Status: Done)
  - Files created/updated: `vite.config.ts` (`PluginOption[]` typing, conditional `singlefile` mode, `@` alias, `worker.format: "es"`), `eslint.config.js` (ESLint 9 flat config with `typescript-eslint`, `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, and `no-restricted-imports` boundary rules a, b, c), `src/test/trivial.test.ts`, `vitest.config.ts`, `package.json` (`lint`, `typecheck`, `test` scripts and Phase 1 deps).
  - Decisions: Scoped 3 noisy rules on legacy files (`no-irregular-whitespace` in `src/components/Batch23Geometry.tsx`, `react-hooks/rules-of-hooks` in `src/components/PartGeometry.tsx`, `no-useless-escape` in `src/customLab/**`) so baseline lint passes without modifying existing app files. Combined `no-restricted-imports` rules for overlapping layers (`src/types/**`, `src/registry/**`, `src/simulation/**` and pure `src/utils/*`) so flat-config blocks do not overwrite each other.
  - Verification: Proven all 3 boundary rules (a, b, c) fail on temporary violating files, deleted all temporary files (including `src/components/tmpViolation1.ts`), and verified `npm run build`, `npm run lint`, `npm run typecheck`, and `npm run test` all pass.
- **Task 1.2a — `src/types/circuit.ts`** (Status: Done)
  - Files created: `src/types/circuit.ts`, `src/types/circuit.test.ts`.
  - Tests: 27 passing (8 describe blocks: constants, FAULT_ORDER, FAULT_PRECEDENCE_LEVEL, PinDefinition narrowing, ComponentElectricalModel narrowing, ComponentPlacement narrowing, PinRef + CircuitFaultKind, NetDescriptor + SimulationFrameOutput).
  - Verification: `npm run build`, `npm run lint`, `npm run typecheck`, and `npm run test` all pass. Proved `expectTypeOf` is checked by `tsc --noEmit` via deliberate break/revert of `quarterTurns` type assertion.

## Blocked / needs my input

_(nothing yet)_

---

## Full task list

### Phase 1 — Core types, pure solver, worker bridge

| ID   | Task                                                             | Status      | Tests | Notes             |
| ---- | ---------------------------------------------------------------- | ----------- | ----- | ----------------- |
| 0    | Repo audit (read-only)                                           | **Done**    | n/a   | See audit section |
| 1.1  | Deps, folders, ESLint import guards                              | **Done**    | 1/1   | `trivial.test.ts` + a/b/c boundary proofs |
| 1.2a | `types/circuit.ts`                                               | Not started |       |                   |
| 1.2b | `types/program.ts`, `types/persistence.ts`, `engineInterface.ts` | Not started |       |                   |
| 1.2c | `utils/breadboardGrid.ts`                                        | Not started |       |                   |
| 1.2d | `utils/manifestValidation.ts`, `test/fixtures.ts`                | Not started |       |                   |
| 1.3  | `unionFindNetlist.ts` (DSU nets + conductor graph)               | Not started |       |                   |
| 1.4  | `dcNodalSolver.ts` (criteria a–i)                                | Not started |       |                   |
| 1.5a | `faultValidator.ts`                                              | Not started |       |                   |
| 1.5b | `behavioralEngine.ts` (tiers, fixed-step, lifecycle)             | Not started |       |                   |
| 1.6a | `worker.ts`, `engineClient.ts`                                   | Not started |       |                   |
| 1.6b | `telemetryStore.ts` + blink-LED integration test                 | Not started |       |                   |

**Phase 1 gate:** all Phase 1 tests green and I can explain commit → worker → frame flow. `[ ]`

### Phase 2 — Calibrator and vertical slice

| ID  | Task                                      | Status      | Notes                     |
| --- | ----------------------------------------- | ----------- | ------------------------- |
| 2.0 | Asset intake (`.glb` files + `ASSETS.md`) | Not started | I must supply the models  |
| 2.1 | `PinCalibrator.tsx`                       | Not started |                           |
| 2.2 | Vertical-slice manifests                  | Not started | Uno needs calibrated pins |

### Phase 3 — Workbench scene, wires, current flow

| ID   | Task                                            | Status      | Notes |
| ---- | ----------------------------------------------- | ----------- | ----- |
| 3.1a | Stores + `engineBridge.ts`                      | Not started |       |
| 3.1b | `persistenceCodec.ts`                           | Not started |       |
| 3.2a | `SandboxCanvas.tsx`, `WorkbenchDesk.tsx`        | Not started |       |
| 3.2b | Breadboard snapping + occupancy preview         | Not started |       |
| 3.2c | `ComponentDrawer.tsx`, `PlacedModule.tsx` shell | Not started |       |
| 3.3  | Wire validation + `JumperWireLayer.tsx`         | Not started |       |
| 3.4  | `CurrentFlowOverlay.tsx`                        | Not started |       |

### Phase 4 — Hardware, VFX, HUD, sharing

| ID   | Task                                       | Status      | Notes |
| ---- | ------------------------------------------ | ----------- | ----- |
| 4.1a | H-bridge, ultrasonic, servo models (tests) | Not started |       |
| 4.1b | Remaining component manifests              | Not started |       |
| 4.1c | Programs + manual pin driver UI            | Not started |       |
| 4.2a | Smoke VFX, scorch materials, reset button  | Not started |       |
| 4.2b | Probe/fault panel + share/export modal     | Not started |       |
| 4.2c | Frame-budget check + Playwright flows      | Not started |       |

---

## Repo audit (Task 0)


### Package versions (`package.json`)

| Package                  | Version (from package.json)                  |
| ------------------------ | -------------------------------------------- |
| `react` / `react-dom`    | `19.2.6`                                     |
| `typescript`             | `5.9.3`                                      |
| `vite`                   | `7.3.7`                                      |
| `three`                  | `^0.187.0`                                   |
| `@react-three/fiber`     | `^9.8.2` ✅ matches ARCHITECTURE §2 (R3F v9) |
| `@react-three/drei`      | `^10.7.9` ✅                                 |
| `@types/three`           | `^0.187.0`                                   |
| `clsx`                   | `2.1.1`                                      |
| `tailwind-merge`         | `3.4.0`                                      |
| `lucide-react`           | `^1.73.0`                                    |
| `tailwindcss`            | `4.1.17`                                     |
| `vite-plugin-singlefile` | `2.3.0`                                      |

**Missing for sandbox tasks (need Task 1.1):** `zustand`, `zundo`, `immer`, `comlink`, `idb-keyval`, `lz-string`, `zod`, `vitest`, `fast-check`.

**Existing scripts:**

```json
"dev":     "vite"
"build":   "vite build"
"preview": "vite preview"
```

No `lint`, `test`, or `typecheck` scripts exist yet.

---

### TypeScript configuration (`tsconfig.json`)

- **`strict: true`** ✅ — strict mode is on.
- **Additional checks:** `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — all `true`.
- **Target:** `ES2020`, module `ESNext`, `moduleResolution: "bundler"`.
- **Path alias:** `"@/*" → ["src/*"]` configured in both `tsconfig.json` and `vite.config.ts`. ✅

---

### ESLint configuration

**None found in the project root.** There is no `eslint.config.*` or `.eslintrc.*` at the repo root (the only ESLint file found is inside `node_modules/tunnel-rat/.eslintrc.json`).

**Implication for Task 1.1:** The `no-restricted-imports` boundary rules required by ARCHITECTURE §8 must be set up from scratch. Need to pick a format (flat `eslint.config.ts` recommended for Vite + TS stacks) and add `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks`, and an import-boundary plugin.

---

### Test setup

**No Vitest or Jest config found** (`vitest.config.*` and `jest.config.*` absent at project root). Vitest is not in `devDependencies`. No `test` script exists.

**Implication:** Vitest must be installed and configured in Task 1.1 before any test-first tasks can run.

---

### Existing `src/` folder collision check

| Sandbox target folder       | Exists?       | Notes                                                  |
| --------------------------- | ------------- | ------------------------------------------------------ |
| `src/types/`                | ✅ **EXISTS** | Contains `simulator.ts` — the existing app's type file |
| `src/utils/`                | ✅ **EXISTS** | Contains `cn.ts` — a Tailwind class helper             |
| `src/registry/`             | ❌ absent     | Safe to create                                         |
| `src/simulation/`           | ❌ absent     | Safe to create                                         |
| `src/store/`                | ❌ absent     | Safe to create                                         |
| `src/components/workbench/` | ❌ absent     | Safe to create                                         |
| `src/components/hud/`       | ❌ absent     | Safe to create                                         |
| `src/components/devtools/`  | ❌ absent     | Safe to create                                         |

**`src/types/simulator.ts` name-conflict risk:** The sandbox needs `src/types/circuit.ts`, `program.ts`, and `persistence.ts` (new files), but `simulator.ts` already occupies the folder. The existing file uses completely different types (`Kind`, `Part`, `BoardSpec`, `FaultRule`, `SimStatus`). No naming collision on the files themselves — but the folder must be shared carefully. Task 1.2a must NOT modify `simulator.ts`.

**`src/utils/cn.ts`:** No conflict — sandbox adds separate files (`breadboardGrid.ts`, `manifestValidation.ts`, `wireValidation.ts`, `wireRouter.ts`).

---

### Zustand / state usage

**None.** There is no zustand or any external state library in the existing codebase. All state lives in `App.tsx` via `useState`/`useRef`/`useEffect`. The sandbox store will be additive.

---

### Existing R3F `<Canvas>` and `OrbitControls`

Two `<Canvas>` setups exist:

1. **`src/components/Viewport3D.tsx`** — the main per-board 3D viewer.
   - Imports `Canvas`, `useFrame` from `@react-three/fiber`; `OrbitControls`, `ContactShadows`, `Environment`, `Lightformer`, `useGLTF` from `@react-three/drei`.
   - **Camera:** not configured in JSX — appears to use R3F default perspective camera.
   - **Depth buffer:** no explicit `gl` props for `logarithmicDepthBuffer` or `near`/`far` on the Canvas. The existing renderer default may differ from ARCHITECTURE requirements (`near=0.002`, `far≤20`, 24-bit depth).
   - **OrbitControls:** present and unlocked (no drag-lock logic).
   - **No `<Html>` or `<Text>` from drei** ✅ (project rule is already followed).

2. **`src/customLab/CustomViewport.tsx`** — an existing sandbox prototype.
   - Imports `Canvas`, `useFrame` from `@react-three/fiber`; `OrbitControls` from `@react-three/drei`.
   - Uses `THREE` directly for geometry.
   - Has a hand-rolled 2D breadboard with `COL_SPACING`, `BOARD_TOP` layout constants (scene unit = ~0.8 arbitrary units, NOT meters).
   - **No `<Html>` or `<Text>`** ✅.

**Reuse potential:** The `OrbitControls` and `Canvas` import patterns in both files are reusable. The `CustomViewport.tsx` prototype has breadboard layout logic that is **not** compatible with the architecture's 1 unit = 1 m convention or `breadboardGrid.ts`, but it demonstrates that the project already enforces the no-`<Html>`/no-`<Text>` rule.

---

### `src/customLab/` — existing sandbox prototype

The `src/customLab/` folder contains a **hand-built prototype** sandbox:

- `CustomLabWorkspace.tsx` — UI shell with tool modes (`place`, `wire`, `probe`, `remove`)
- `CustomViewport.tsx` — 3D breadboard render (procedural geometry, no `.glb`)
- `customTypes.ts` — defines `PlacedCustomPart`, `CustomWire`, `CustomSimResult`
- `netlistSolver.ts` — a simple netlist solver
- `presetData.ts` — starter preset circuits

This prototype is **independent** of the sandbox architecture described in `ARCHITECTURE.md`. Its types (`CustomComponentType`, `PlacedCustomPart`) are **not** the same as the architecture's (`ComponentDef`, `PlacedComponent`, `ComponentPlacement`). It uses a simplified `gridCol`/`gridRow: "top"|"bottom"` placement model, not `HoleCoord`. Its `CustomSimResult` is not the architecture's `SimulationFrameOutput`.

**Risk:** Future tasks must decide whether to delete, replace, or coexist with this prototype. It is currently wired into `App.tsx` via `showCustomLab` toggle. Task 1.1 should not touch it, but Tasks 3.x that add `SandboxCanvas.tsx` will need to swap it out or route around it.

---

### Conflicts with ARCHITECTURE §2 (React 19, R3F v9)

| Item                                   | Status                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 19                               | ✅ already on 19.2.6                                                                                                                                                                                                                                                                                                                                                                   |
| R3F v9                                 | ✅ already on 9.8.2                                                                                                                                                                                                                                                                                                                                                                    |
| `@react-three/drei` v10                | ✅ already on 10.7.9                                                                                                                                                                                                                                                                                                                                                                   |
| `viteSingleFile` plugin                | ⚠️ **May conflict** — this plugin inlines all assets into a single HTML file. The sandbox architecture loads `.glb` from `public/models/` at runtime and uses a Web Worker (`src/simulation/worker.ts`). Both are incompatible with `vite-plugin-singlefile` (workers and large binary assets cannot be inlined). Task 1.1 must decide if this plugin stays or is removed/conditioned. |
| No ESLint config                       | ⚠️ All `no-restricted-imports` boundary rules are absent. Must be created in Task 1.1.                                                                                                                                                                                                                                                                                                 |
| No test runner                         | ⚠️ Vitest not installed. Must be installed in Task 1.1.                                                                                                                                                                                                                                                                                                                                |
| Camera/depth settings                  | ⚠️ Existing `Viewport3D.tsx` doesn't set `near=0.002`/`far≤20`. Sandbox's `SandboxCanvas.tsx` must set these explicitly.                                                                                                                                                                                                                                                               |
| `vite-plugin-singlefile` + Web Workers | ⚠️ See above. Sandbox worker (`worker.ts`) requires Vite's native worker bundling (`?worker` suffix or `Worker` constructor with `type: 'module'`).                                                                                                                                                                                                                                    |

---

### Risks and questions for you

**Risks:**

1. **`vite-plugin-singlefile` incompatibility** — the existing build plugin inlines everything into one HTML file, which is incompatible with Web Workers (required for `src/simulation/worker.ts`) and runtime-fetched `.glb` assets. Options: (a) remove the plugin, (b) add a Vite `build.rollupOptions` condition to disable it for the sandbox entry point, (c) keep it for the existing app and use a separate Vite entry/config for the sandbox.

2. **`src/customLab/` prototype coexistence** — the existing prototype is already wired into `App.tsx`. Will the new sandbox **replace** it or **coexist** alongside it? This affects whether `CustomLabWorkspace.tsx` and `CustomViewport.tsx` are deleted during Phase 3.

3. **No `lint` or `typecheck` scripts** — TASKS.md acceptance criteria all say "ESLint passes". There is no `npm run lint` script. Task 1.1 must add it; I need to confirm the ESLint version and flat-config vs. `.eslintrc` preference.

4. **`src/types/simulator.ts` shared folder** — existing app types live here. New sandbox types go in the same folder. This is safe as long as new files are named correctly, but the ESLint import-boundary rule for `src/types/**` (no `react`/`three` imports) must not reject the existing `simulator.ts` which does not import either — ✅ no problem, but needs confirming before writing the ESLint rule.

5. **`noUnusedLocals` / `noUnusedParameters`** — strict TS flags will reject stub files with unused parameters or placeholder types. All new files in Phase 1 must be complete enough to pass the compiler.

**Questions for you:**

1. **`vite-plugin-singlefile`:** Should I remove it, disable it conditionally, or keep it for the existing boards and add a separate sandbox dev/build path?
2. **`src/customLab/` prototype:** Delete it, freeze it in place, or migrate it to the new architecture as we go?
3. **ESLint:** Flat config (`eslint.config.ts`) or legacy (`.eslintrc.js`)? Any preferred ESLint version?
4. **`npm run lint` script:** Should I add it in Task 1.1 (pointing to `eslint src`)?
5. **`npm run typecheck` script:** Should I add `tsc --noEmit` as a separate script, or is `npm run build` (which does `vite build`, which uses esbuild and skips type checking) sufficient?
6. **Docs location:** The sandbox docs live at `src/docs/sandbox/` (inside `src/`), not `docs/sandbox/`. Should they stay there, or should I move them to a top-level `docs/` folder? (Affects the initial task prompt paths but can be ignored if you are happy with `src/docs/`.)

## Decisions log

| Date       | Decision                                                               | Why                               | Docs affected |
| ---------- | ---------------------------------------------------------------------- | --------------------------------- | ------------- |
|            |                                                                        |                                   |               |
| 2026-11-27 | singlefile plugin conditional via mode flag, default off               | workers/.glb need separate assets | vite.config   |
| 2026-11-27 | delete src/customLab (own commit)                                      | replaced by new sandbox           | App.tsx       |
| 2026-11-27 | ESLint flat config eslint.config.js; baseline must pass; no mass edits | no ESLint existed                 | Task 1.1      |
| 2026-11-27 | scripts: lint, typecheck, test                                         |                                   | package.json  |
| 2026-11-27 | docs stay in src/docs/sandbox/                                         |                                   | all prompts   |
| 2026-11-27 | Scope 3 lint rules on legacy files only (`Batch23Geometry.tsx`, `PartGeometry.tsx`, `src/customLab/**`) | Baseline must pass without editing existing app files | `eslint.config.js` |

## Fixture constants (fill in during Task 1.2d, then treat as fixed)

| Constant                | Value |
| ----------------------- | ----- |
| LED `vf`                |       |
| LED `rdOhm`             |       |
| Supply `internalOhm`    | 0.1 Ω |
| GPIO `internalOhm`      | 25 Ω  |
| Pushbutton `contactOhm` |       |

## Measured performance (fill in during Task 4.2c)

| Metric                   | Target                     | Measured |
| ------------------------ | -------------------------- | -------- |
| Sim tick                 | ≤ 2 ms                     |          |
| FPS (12 comps, 60 wires) | 60                         |          |
| Draw calls               | documented ceiling: \_\_\_ |          |
| Geometry/material leaks  | 0                          |          |

## Open issues

- _(none)_
