# Robotics Bench
Assemble circuits on real boards, power them up, and break them on purpose to see what happens.

```
npm install
npm run dev     # open http://localhost:5173
npm test        # runs the rules-engine tests
```

## How the code is organised (read in this order)
| File | What it is |
|---|---|
| `src/data/types.ts` | The vocabulary: parts, rules, board state |
| `src/data/boards.ts` | The boards themselves, written as plain data |
| `src/engine/evaluateBoard.ts` | The "brain": given progress, what happens when powered? (no React) |
| `src/engine/boardStatus.ts` | Turns progress into status text and help messages |
| `src/store/benchStore.ts` | App state + actions (Zustand). Every action re-runs the engine |
| `src/engine/currentFlow.ts` | Works out which copper segments carry current (normal, surge or blocked) |
| `src/components/CurrentFlowLayer.tsx` | Draws the traces, moving current dots and the red break markers |
| `src/components3d/*` | The 3D view (React Three Fiber): `Stage3D` (camera, light), `Board3D` (PCB, traces, current), `Part3D` (spring animation), `PartModel` (each part's shape) |
| `src/render3d/scene.ts` | Converts board coordinates to 3D scene coordinates |
| `src/render/isometric.tsx` | Fake-3D drawing maths, `IsoBox` and `IsoCylinder` |
| `src/render/PartShape.tsx` | What each kind of part looks like (resistor bands, chip pins, motor...) |
| `src/components/*` | UI: `PartSprite` (animated part), `BoardStage`, `Sidebar` (board list), `PartsTray` (the parts, beside the board), `StatusBar`, `ControlBar` |

## The 13 boards
LED + resistor · Transistor switch · Arduino Uno · ESP32-S3 · TB6612FNG · L298N · A4988 · PCA9685 · MPU-6050 · HC-SR04 · Relay module · BME280 · Servo + external power.
Red-outlined parts are **mistakes**: place one on purpose to see what breaks. "Place all" skips them.

## What happens when you click a part name
1. `Sidebar` calls `togglePart(id)` in the store.
2. The store adds/removes the id in `placedPartIds`, then calls `evaluateBoard`.
3. React re-renders; `BoardStage` passes `isPlaced=true` to that `PartSprite`.
4. `PartSprite` switches its Framer Motion look from `inTheBin` to `placed`, so it springs down onto the board.
Nothing is animated by hand: state changes, and the animation follows.

## Add a new board
1. Append an object to `BOARDS` in `src/data/boards.ts` (parts + rules + lesson text).
2. Add a test in `src/engine/evaluateBoard.test.ts`.
3. Run `npm test` and look at it in `npm run dev`.

## Glossary
- **Placed**: the part is on the board. **Soldered**: its joints are fixed. A part only works electrically if it is both (and not burned).
- **Rule**: "if this condition is true, this is the outcome". The first matching rule wins.
