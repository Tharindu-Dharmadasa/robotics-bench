# Robotics Bench — Agent Instructions

- **Stack:** React 19, TypeScript, Vite, Tailwind CSS, Three.js (`@react-three/fiber`, `@react-three/drei`), Lucide Icons.
- **Documentation:** See `docs/PRD.md` (requirements), `docs/ARCHITECTURE.md` (structure & state), and `docs/PLAN.md` (milestones).
- **Strict Rules:**
  1. NEVER use `@react-three/drei` `<Html>` or `<Text>` inside `<Canvas>` (triggers React 19 synchronous root unmount errors). Use the 2D HUD overlay for labels/hover tooltips.
  2. Edit ONLY the specific files requested in the prompt. Do not rewrite unrelated components.
  3. Maintain procedural Three.js fallbacks even when `.glb` model loading is added.
