# System Architecture — Robotics Bench

## 1. Directory Structure

```text
public/
  models/                 # Optional .glb assets (e.g., fig-01.glb, fig-04.glb)
docs/
  PRD.md                  # Functional & UI requirements
  ARCHITECTURE.md         # Component & state architecture
  PLAN.md                 # Phased build roadmap
src/
  types/
    simulator.ts          # Part, Kind, BoardSpec, FaultRule, SimStatus types
  data/
    boards.ts             # Data registry for all 13 labs (parts, code, descriptions, faults)
  components/
    Sidebar.tsx           # Left navigation list of 13 labs
    ControlColumn.tsx     # Bench action buttons, PCB color picker, fault trigger
    Viewport3D.tsx        # R3F <Canvas>, lighting, camera, HUD overlays
    PartGeometry.tsx      # Procedural 3D meshes, AnimatedPart lerp, SolderJoints, UsbCable, Pcb
    BottomPanels.tsx      # 3-column footer (About, C++ Code + Copy, Serial Monitor)
  App.tsx                 # Top-level state orchestration & layout shell
```

## 2. State & Animation Model

- **Assembly State:** Tracked via `placed: Set<string>`, `soldered: boolean`, `usb: boolean`, `exploded: boolean`, `running: boolean`, and `fault: string | null`.
- **3D Interpolation (`useFrame`):**
  - `AnimatedPart` smoothly lerps `position.y` between hidden (`y = 7`), installed (`PCB_T / 2`), and exploded (`PCB_T / 2 + layer * 1.1`).
  - `SolderJoints` scales metallic cones from `0` to `1` on through-hole pins.
  - `UsbCable` slides along the X-axis into the port when `usb === true`.
- **Hybrid 3D Asset Strategy:**
  - Every part has a procedural Three.js mesh in `PartGeometry.tsx` so labs work offline with zero external dependencies.
  - Optional `.glb` models in `public/models/` can be mounted via `<GlbBoardModel>` wrapped in an ErrorBoundary.
