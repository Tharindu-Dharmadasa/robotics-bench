# Project Guide

## Project overview

Robotics Bench is a React app for assembling circuits on 13 example boards. Users
place parts, power the board, and see circuit status and current flow in either
3D or 2D.

### Tech stack

- TypeScript 5, React 18, and Vite 5
- Tailwind CSS 4 for styling
- React Three Fiber, Three.js, and Drei for the interactive 3D view
- Zustand for shared board state
- Framer Motion for UI and part animations
- Vitest for tests; TypeScript strict mode is enabled

### Project structure

- `src/App.tsx` — page composition and 2D/3D view selection
- `src/components/` — 2D board, controls, parts tray, status, and flow UI
- `src/components3d/` — 3D board, parts, models, and scene
- `src/data/` — board definitions and shared types
- `src/engine/` — board evaluation, status, and current-flow logic and tests
- `src/render/` — 2D/isometric drawing helpers
- `src/render3d/` — shared 3D scene measurements and coordinate conversion
- `src/store/` — Zustand app state and actions
- `index.html`, `vite.config.ts`, `tsconfig.json` — app entry and tooling config

## Common commands

Run from the repository root:

```sh
npm install       # install dependencies (npm ci for a clean lockfile install)
npm run dev       # start the Vite development server
npm test          # run the Vitest suite once
npm run build     # type-check and create the production build in dist/
npm run lint      # run the TypeScript compiler checks
```

## Coding conventions

- Keep TypeScript strict and use explicit domain types from `src/data/types.ts`.
- Use functional React components and hooks; keep app state/actions in the
  Zustand store rather than duplicating board state in view components.
- Keep board content declarative in `src/data/boards.ts`; keep evaluation logic
  independent of React in `src/engine/`.
- The 2D and 3D views should consume the same board definitions and state.
- Match nearby formatting: most files use two-space indentation, double-quoted
  imports, and semicolons. Follow the existing file style when editing.
- Add or update Vitest tests for board-rule and current-flow behavior changes.
- Prefer small, focused components and reuse existing helpers for rendering and
  coordinate conversion.

## Current Progress & Next Steps

- Latest commit (`2ea53ac`, “Add 3d boards using React Three Fiber”) introduced
  3D support. It changed `package.json`/`package-lock.json`, `src/App.tsx`,
  `src/components/PartsTray.tsx`, `src/components/Sidebar.tsx`, and added
  `src/components3d/Board3D.tsx`, `Part3D.tsx`, `PartModel.tsx`, `Stage3D.tsx`,
  and `src/render3d/scene.ts`.
- The 3D view is the default and is lazy-loaded; the 2D view remains selectable.
  Both views use the same board data and store state.
- The worktree was clean when this guide was written. No `TODO`/`FIXME` markers
  were found in `src/`.
- Next, run `npm test` and `npm run build`, then manually verify 3D/2D switching,
  placing/removing parts, board changes, powered/fault states, current-flow
  visualization, and orbit/zoom at desktop and narrow viewport sizes.
- The current automated suite tests the rules engine and current flow. Consider
  adding focused tests for any new behavior uncovered in 3D interaction checks.
