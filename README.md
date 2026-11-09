# Robotics Bench
Interactive robotics simulator: assemble circuits on real boards, power them, break them on purpose.
```
npm install
npm run dev     # http://localhost:5173
npm test        # engine rules
```
Architecture: `data/` (boards as typed data) -> `engine/` (pure rules, no React) -> `store/` (Zustand) -> `components/` (SVG stage + Framer Motion).
Add a board: append a `BoardDef` in `src/data/boards.ts` and a test in `src/engine/evaluate.test.ts`.
