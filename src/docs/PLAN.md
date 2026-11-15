# Implementation Plan — Robotics Bench

- **Phase 1: Core Prototype & Bugfix (Completed)**
  - Retro-hardware UI shell, orthographic Three.js stage, Board 01 (Arduino Uno R3) procedural parts, assembly animations, and serial monitor.
- **Phase 2: Modular Refactor (Current)**
  - Split monolithic `App.tsx` into `types/`, `data/`, and `components/` while preserving exact behavior.
- **Phase 3: Full 13-Board Expansion (via Google AI Studio Free Tier)**
  - Add procedural geometries (`esp32`, `ultrasonic`, `motorDriver`, `stepperDriver`, `servo`, `imu`, `encoder`, `oled`) and populate `src/data/boards.ts` for Figs. 02–13.
- **Phase 4: Interactive Faults & `.glb` Asset Support (via OpenCode)**
  - Wire up per-board fault simulation (`Break Part / Fault Test`), visual failure effects (red glow/smoke), and optional `.glb` model loading.
