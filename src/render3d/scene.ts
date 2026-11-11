// Shared 3D measurements. Board data uses flat units (0–240 wide, 0–150 deep);
// the 3D scene uses UNIT scene-units per board unit, with the board centred on the origin.
export const UNIT = 0.04;
export const BOARD_WIDTH = 240, BOARD_DEPTH = 150;
export const PCB_THICKNESS = 0.28;

/** Board position (x, y) plus a height above the PCB surface -> a 3D scene position [x, y, z]. */
export const toScene = (x: number, y: number, height = 0): [number, number, number] => [
  (x - BOARD_WIDTH / 2) * UNIT,
  PCB_THICKNESS / 2 + height * UNIT, // the PCB surface sits at y = thickness / 2
  (y - BOARD_DEPTH / 2) * UNIT,
];
