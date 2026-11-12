// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers. We fake 3D with an "isometric" view: board coordinates
// (x, y, height) become flat 2D screen coordinates. Boxes are drawn as three
// visible faces; cylinders as a side shape plus an ellipse on top.
// ─────────────────────────────────────────────────────────────────────────────
const SCREEN_CENTER_X = 300; // where board position (0,0) lands on screen
const SCREEN_TOP_Y = 100;
export const X_SCALE = 1.212; // cos(30°) × 1.4 zoom: sideways movement per board unit
export const Y_SCALE = 0.7; // sin(30°) × 1.4 zoom: downward movement per board unit

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

/** A horizontal circle of this radius appears as an ellipse this wide/tall in our projection. */
export const ellipseRadii = (radius: number) => ({
  rx: radius * Math.SQRT2 * X_SCALE,
  ry: radius * Math.SQRT2 * Y_SCALE,
});

export const OUTLINE_STYLE = {
  stroke: "var(--ink)",
  strokeWidth: 1.5,
  strokeLinejoin: "round",
} as const;
// Different brightness per face creates the 3D look.
const LEFT_FACE_SHADE = "brightness(.82)";
const RIGHT_FACE_SHADE = "brightness(.64)";

interface IsoBoxProps {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  z0?: number;
  windowed?: boolean;
}

/** A 3D box (left face, right face, top face). `z0` lifts it off the board; `windowed` adds a dark opening on the front. */
export function IsoBox({
  x,
  y,
  width,
  depth,
  height,
  color,
  z0 = 0,
  windowed = false,
}: IsoBoxProps) {
  const top = z0 + height;
  return (
    <g fill={color} {...OUTLINE_STYLE}>
      <polygon
        style={{ filter: LEFT_FACE_SHADE }}
        points={toPolygonPoints([
          [x, y + depth, z0],
          [x + width, y + depth, z0],
          [x + width, y + depth, top],
          [x, y + depth, top],
        ])}
      />
      <polygon
        style={{ filter: RIGHT_FACE_SHADE }}
        points={toPolygonPoints([
          [x + width, y, z0],
          [x + width, y + depth, z0],
          [x + width, y + depth, top],
          [x + width, y, top],
        ])}
      />
      <polygon
        points={toPolygonPoints([
          [x, y, top],
          [x + width, y, top],
          [x + width, y + depth, top],
          [x, y + depth, top],
        ])}
      />
      {windowed && (
        <polygon
          fill="#111"
          points={toPolygonPoints([
            [x + 4, y + depth, z0 + 3],
            [x + width - 4, y + depth, z0 + 3],
            [x + width - 4, y + depth, top - 3],
            [x + 4, y + depth, top - 3],
          ])}
        />
      )}
    </g>
  );
}

interface IsoCylinderProps {
  cx: number;
  cy: number;
  radius: number;
  height: number;
  color: string;
  z0?: number;
}

/** An upright cylinder centred on board position (cx, cy). */
export function IsoCylinder({
  cx,
  cy,
  radius,
  height,
  color,
  z0 = 0,
}: IsoCylinderProps) {
  const { rx, ry } = ellipseRadii(radius);
  const bottom = projectToScreen(cx, cy, z0),
    top = projectToScreen(cx, cy, z0 + height);
  // Side silhouette: up the left edge, across the top, down the right edge, then round the front of the base.
  const side = `M ${bottom.x - rx} ${bottom.y} L ${top.x - rx} ${top.y} L ${top.x + rx} ${top.y} L ${bottom.x + rx} ${bottom.y} A ${rx} ${ry} 0 0 1 ${bottom.x - rx} ${bottom.y} Z`;
  return (
    <g fill={color} {...OUTLINE_STYLE}>
      <path d={side} style={{ filter: LEFT_FACE_SHADE }} />
      <ellipse cx={top.x} cy={top.y} rx={rx} ry={ry} />
    </g>
  );
}
