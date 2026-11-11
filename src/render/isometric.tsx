// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers. We fake 3D with an "isometric" view: board coordinates
// (x, y, height) are converted to flat 2D screen coordinates, and every box is
// drawn as three visible faces (top, left side, right side).
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_CENTER_X = 300; // where board position (0,0) lands on screen
const SCREEN_TOP_Y = 100;
const X_SCALE = 1.212; // cos(30°) × 1.4 zoom: how far one board unit moves us sideways
const Y_SCALE = 0.7; // sin(30°) × 1.4 zoom: how far one board unit moves us down

/** Converts a 3D board position into a 2D screen position. Higher `height` moves the point up. */
export function projectToScreen(
  x: number,
  y: number,
  height = 0,
): { x: number; y: number } {
  return {
    x: SCREEN_CENTER_X + (x - y) * X_SCALE,
    y: SCREEN_TOP_Y + (x + y) * Y_SCALE - height,
  };
}

type Corner = [x: number, y: number, height: number];

/** Turns a list of 3D corners into the "points" string an SVG <polygon> expects. */
export function toPolygonPoints(corners: Corner[]): string {
  return corners
    .map(([x, y, height]) => {
      const point = projectToScreen(x, y, height);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

export const OUTLINE_STYLE = {
  stroke: "var(--ink)",
  strokeWidth: 1.5,
  strokeLinejoin: "round",
} as const;

// CSS brightness values give each face a different shade, which creates the 3D look.
const LEFT_FACE_SHADE = "brightness(.82)";
const RIGHT_FACE_SHADE = "brightness(.64)";

interface IsoBoxProps {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  color: string;
}

/** A 3D box drawn as three polygons: left face, right face, then the top face. */
export function IsoBox({ x, y, width, depth, height, color }: IsoBoxProps) {
  return (
    <g fill={color} {...OUTLINE_STYLE}>
      <polygon
        style={{ filter: LEFT_FACE_SHADE }}
        points={toPolygonPoints([
          [x, y + depth, 0],
          [x + width, y + depth, 0],
          [x + width, y + depth, height],
          [x, y + depth, height],
        ])}
      />
      <polygon
        style={{ filter: RIGHT_FACE_SHADE }}
        points={toPolygonPoints([
          [x + width, y, 0],
          [x + width, y + depth, 0],
          [x + width, y + depth, height],
          [x + width, y, height],
        ])}
      />
      <polygon
        points={toPolygonPoints([
          [x, y, height],
          [x + width, y, height],
          [x + width, y + depth, height],
          [x, y + depth, height],
        ])}
      />
    </g>
  );
}
