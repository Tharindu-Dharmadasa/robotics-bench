// ---------------------------------------------------------------------------
// src/utils/breadboardGrid.ts -- Canonical Breadboard Grid (Parts 1 and 2 of 3)
//
// HoleCoord <-> PinAddress formatting/parsing, bounds checks, strip membership,
// local 3D position lookup, and analytic nearest-hole hit-testing.
// Pure module: no React, Three.js, store, DOM, Math.random, or Date.
//
// FRAME: board-local, metres.
//   Origin = centre of the board footprint on the top surface.
//   +x runs along cols (col 0 is most negative x).
//   +z runs along rows (row 0 of MAIN is most negative z for hasCenterGap=true).
//   y = 0 is the top surface; all returned y values are 0.
//
// MAIN row layout (z-axis, centred on z=0, hasCenterGap=true):
//   Top side = rows 0..(rowsPerSide-1), bottom side = rows rowsPerSide..(2*rowsPerSide-1).
//   The step from innermost top row (rowsPerSide-1) to innermost bottom row (rowsPerSide)
//   is (1 + CENTER_GAP_EXTRA_PITCHES) * pitchMeters; all other adjacent-row steps are 1 pitch.
//   When hasCenterGap=false CENTER_GAP_EXTRA_PITCHES is not applied and rows are uniform.
//
// RAIL layout:
//   TOP rails are at negative z beyond row 0; BOT rails are at positive z beyond row 2*rowsPerSide-1.
//   The nearest rail row to the main grid is offset by RAIL_OFFSET_PITCHES pitches.
//   For TOP: TOP_POS is the inner (less negative) rail; TOP_NEG is the outer (more negative) rail.
//   For BOT: BOT_POS is the inner (less positive) rail; BOT_NEG is the outer (more positive) rail.
//   Rail cols are centred on x=0; a gap of (1+RAIL_SEGMENT_GAP_EXTRA_PITCHES) pitches separates
//   the last col of one railSegments segment from the first col of the next.
// ---------------------------------------------------------------------------

import type {
  BreadboardRegion,
  GridSpec,
  HoleCoord,
  PinAddress,
  SafeId,
} from "@/types/circuit";
import { SAFE_ID_REGEX } from "@/types/persistence";

// ---------------------------------------------------------------------------
// Exported named constants (all in pitch multiples so they scale with pitchMeters)
// ---------------------------------------------------------------------------

/** Extra spacing across the centre gap so adjacent-side rows are 3 pitches apart. */
export const CENTER_GAP_EXTRA_PITCHES = 2;

/** Distance in pitches from the outermost MAIN row to the nearest rail row. */
export const RAIL_OFFSET_PITCHES = 1.5;

/** Extra pitch spacing between adjacent railSegments segments (gap = 1+this pitches). */
export const RAIL_SEGMENT_GAP_EXTRA_PITCHES = 1;

/** Default snap/hit radius as a fraction of pitchMeters. */
export const HIT_RADIUS_PITCHES = 0.45;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ParsedHoleAddress {
  boardId: SafeId;
  hole: HoleCoord;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const VALID_REGIONS: ReadonlySet<string> = new Set<BreadboardRegion>([
  "MAIN",
  "TOP_POS",
  "TOP_NEG",
  "BOT_POS",
  "BOT_NEG",
]);

const CANONICAL_NON_NEG_INT_REGEX = /^(0|[1-9][0-9]*)$/;

function isValidRegion(region: string): region is BreadboardRegion {
  return VALID_REGIONS.has(region);
}

function isNonNegativeSafeInt(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function getRailSegmentIndex(grid: GridSpec, col: number): number {
  if (grid.railSegments === undefined) {
    return 0;
  }
  let offset = 0;
  for (let i = 0; i < grid.railSegments.length; i++) {
    const segLen = grid.railSegments[i];
    if (!Number.isSafeInteger(segLen) || segLen <= 0) {
      return -1;
    }
    if (col < offset + segLen) {
      return i;
    }
    offset += segLen;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 1.2c-i exports (unchanged)
// ---------------------------------------------------------------------------

/**
 * Formats a breadboard hole coordinate into canonical PinAddress form:
 * "<boardId>:<region>:<col>:<row>".
 * Throws if `boardId` fails `SAFE_ID_REGEX`, `region` is invalid, or `col`/`row`
 * are not non-negative safe integers.
 */
export function formatHoleAddress(boardId: SafeId, hole: HoleCoord): PinAddress {
  if (!SAFE_ID_REGEX.test(boardId)) {
    throw new Error(`Invalid boardId for hole address: "${boardId}"`);
  }
  if (!isValidRegion(hole.region)) {
    throw new Error(`Invalid breadboard region: "${String(hole.region)}"`);
  }
  if (!isNonNegativeSafeInt(hole.col) || !isNonNegativeSafeInt(hole.row)) {
    throw new Error(
      `Invalid hole coordinates (col=${hole.col}, row=${hole.row}); expected non-negative safe integers`
    );
  }
  return `${boardId}:${hole.region}:${hole.col}:${hole.row}`;
}

/**
 * Parses a canonical breadboard hole address "<boardId>:<region>:<col>:<row>".
 * Returns `null` on any malformed input without throwing. Does not check `GridSpec` bounds.
 */
export function parseHoleAddress(address: PinAddress): ParsedHoleAddress | null {
  if (typeof address !== "string") {
    return null;
  }
  const parts = address.split(":");
  if (parts.length !== 4) {
    return null;
  }

  const [boardId, region, colStr, rowStr] = parts;
  if (!SAFE_ID_REGEX.test(boardId)) {
    return null;
  }
  if (!isValidRegion(region)) {
    return null;
  }
  if (
    !CANONICAL_NON_NEG_INT_REGEX.test(colStr) ||
    !CANONICAL_NON_NEG_INT_REGEX.test(rowStr)
  ) {
    return null;
  }

  const col = Number(colStr);
  const row = Number(rowStr);
  if (!Number.isSafeInteger(col) || !Number.isSafeInteger(row)) {
    return null;
  }

  return {
    boardId,
    hole: { region, col, row },
  };
}

/**
 * Checks whether `hole` lies within the valid bounds of `grid` per ARCHITECTURE ss5.5.
 */
export function isHoleInBounds(grid: GridSpec, hole: HoleCoord): boolean {
  if (!isValidRegion(hole.region)) {
    return false;
  }
  if (!isNonNegativeSafeInt(hole.col) || !isNonNegativeSafeInt(hole.row)) {
    return false;
  }

  if (hole.region === "MAIN") {
    if (
      !Number.isSafeInteger(grid.cols) ||
      grid.cols <= 0 ||
      !Number.isSafeInteger(grid.rowsPerSide) ||
      grid.rowsPerSide <= 0
    ) {
      return false;
    }
    return hole.col < grid.cols && hole.row < 2 * grid.rowsPerSide;
  }

  if (
    !grid.hasPowerRails ||
    grid.railCols === undefined ||
    !Number.isSafeInteger(grid.railCols) ||
    grid.railCols <= 0
  ) {
    return false;
  }
  return hole.col < grid.railCols && hole.row === 0;
}

/**
 * Checks whether two holes on the same breadboard belong to the same electrically
 * connected strip per ARCHITECTURE ss5.5. Callers must ensure both holes belong to
 * the same `boardId`.
 */
export function areHolesInSameStrip(
  grid: GridSpec,
  a: HoleCoord,
  b: HoleCoord
): boolean {
  if (!isHoleInBounds(grid, a) || !isHoleInBounds(grid, b)) {
    return false;
  }

  if (a.region === "MAIN" || b.region === "MAIN") {
    if (a.region !== b.region || a.col !== b.col) {
      return false;
    }
    if (!grid.hasCenterGap) {
      // ARCHITECTURE ss5.5 specifies center gap splitting rows into two sides;
      // approved assumption (Option A): when hasCenterGap is false, all rows
      // 0..2*rowsPerSide-1 in the same col belong to a single MAIN strip.
      return true;
    }
    return a.row < grid.rowsPerSide === b.row < grid.rowsPerSide;
  }

  if (a.region !== b.region) {
    return false;
  }

  const segA = getRailSegmentIndex(grid, a.col);
  const segB = getRailSegmentIndex(grid, b.col);
  if (segA === -1 || segB === -1) {
    return false;
  }
  return segA === segB;
}

// ---------------------------------------------------------------------------
// 1.2c-ii: local 3D position helpers
// ---------------------------------------------------------------------------

/**
 * Returns the x offset (metres) for a MAIN col, centred on x=0.
 * col 0 is most negative x.
 */
function mainColToX(grid: GridSpec, col: number): number {
  // Centre = (cols - 1) / 2 pitches from col 0.
  return (col - (grid.cols - 1) / 2) * grid.pitchMeters;
}

/**
 * Returns the z offset (metres) for a MAIN row, centred on z=0.
 * With hasCenterGap=true: rows 0..(rps-1) are top side (negative z),
 * rows rps..(2*rps-1) are bottom side (positive z).
 * Row 0 is outermost top (most negative z).
 */
function mainRowToZ(grid: GridSpec, row: number): number {
  const rps = grid.rowsPerSide;
  const p = grid.pitchMeters;
  if (grid.hasCenterGap) {
    // Total physical span in pitches: (rps-1) + (1+CENTER_GAP_EXTRA_PITCHES) + (rps-1)
    // = 2*rps - 1 + CENTER_GAP_EXTRA_PITCHES
    // z of row 0 (outermost top) = -((2*rps-1+CENTER_GAP_EXTRA_PITCHES)/2)*p
    const topOuterZ = -((2 * rps - 1 + CENTER_GAP_EXTRA_PITCHES) / 2) * p;
    if (row < rps) {
      // Top side: rows increase toward 0 (less negative z)
      return topOuterZ + row * p;
    }
    // Bottom side: row=rps is innermost bottom
    // z of innermost bottom = z of outermost top + (rps-1)*p + (1+CENTER_GAP_EXTRA_PITCHES)*p
    const botInnerZ = topOuterZ + (rps - 1 + 1 + CENTER_GAP_EXTRA_PITCHES) * p;
    return botInnerZ + (row - rps) * p;
  }
  // No center gap: rows uniformly spaced, centred on z=0
  // Total span = (2*rps-1) pitches; row 0 at z = -(2*rps-1)/2*p
  return (row - (2 * rps - 1) / 2) * p;
}

/**
 * Computes the inverse of mainRowToZ: given a z coordinate, returns the nearest
 * candidate top-side row and bottom-side row (fractional), plus the boundary info
 * needed to detect centre-gap hits.
 * Returns { topFrac, botFrac, inGap } where topFrac/botFrac are fractional row
 * indices and inGap=true when z falls strictly inside the centre gap.
 */
function zToMainRowFracs(
  grid: GridSpec,
  z: number
): { topFrac: number; botFrac: number; inGap: boolean } {
  const rps = grid.rowsPerSide;
  const p = grid.pitchMeters;

  if (grid.hasCenterGap) {
    const topOuterZ = -((2 * rps - 1 + CENTER_GAP_EXTRA_PITCHES) / 2) * p;
    const topInnerZ = topOuterZ + (rps - 1) * p; // row rps-1
    const botInnerZ = topInnerZ + (1 + CENTER_GAP_EXTRA_PITCHES) * p; // row rps

    // Gap boundaries (exclusive): z in (topInnerZ + 0.5*p, botInnerZ - 0.5*p)
    const gapLo = topInnerZ + 0.5 * p;
    const gapHi = botInnerZ - 0.5 * p;
    const inGap = z > gapLo && z < gapHi;

    const topFrac = (z - topOuterZ) / p; // fractional row in top-side coords
    const botFrac = (z - botInnerZ) / p + rps; // fractional row in full-row coords
    return { topFrac, botFrac, inGap };
  }

  // No center gap
  const row0Z = -(2 * rps - 1) / 2 * p;
  const frac = (z - row0Z) / p;
  return { topFrac: frac, botFrac: frac, inGap: false };
}

/**
 * Returns the x offset for a rail col, centred on x=0, applying segment gaps.
 * With no railSegments, the whole rail is one segment (no gaps).
 */
function railColToX(grid: GridSpec, col: number): number {
  const p = grid.pitchMeters;
  const segs = grid.railSegments;

  if (segs === undefined || segs.length <= 1) {
    // Single segment or no segments defined: railCols cols, uniform, centred.
    const railCols = grid.railCols ?? 0;
    return (col - (railCols - 1) / 2) * p;
  }

  // Find physical position of this col accounting for segment gaps.
  // Physical position = col index + (segmentIndex * RAIL_SEGMENT_GAP_EXTRA_PITCHES)
  let segOffset = 0; // how many actual rail cols we've passed
  let physPos = 0;
  for (let i = 0; i < segs.length; i++) {
    const segLen = segs[i];
    if (col < segOffset + segLen) {
      // col is in segment i, at local index (col - segOffset)
      physPos = segOffset + i * RAIL_SEGMENT_GAP_EXTRA_PITCHES + (col - segOffset);
      break;
    }
    segOffset += segLen;
    // If col is beyond all segments, physPos stays 0 -- caller should use isHoleInBounds
  }

  // Total physical width = sum of all seg lengths + (numSegs-1)*RAIL_SEGMENT_GAP_EXTRA_PITCHES
  const totalRailCols = segs.reduce((acc, s) => acc + s, 0);
  const totalPhysical = totalRailCols + (segs.length - 1) * RAIL_SEGMENT_GAP_EXTRA_PITCHES;
  const centre = (totalPhysical - 1) / 2;
  return (physPos - centre) * p;
}

/**
 * Inverse of railColToX: given an x coordinate, returns the fractional rail col
 * for the given grid. Handles segment gaps analytically.
 * Returns a list of candidate (col, distanceSquared) pairs after rounding.
 */
function xToRailColCandidates(
  grid: GridSpec,
  x: number
): Array<{ col: number; physPos: number }> {
  const p = grid.pitchMeters;
  const segs = grid.railSegments;
  const railCols = grid.railCols ?? 0;

  if (segs === undefined || segs.length <= 1) {
    // No gaps
    const centre = (railCols - 1) / 2;
    const fracCol = x / p + centre;
    const lo = Math.floor(fracCol);
    const hi = lo + 1;
    return [
      { col: lo, physPos: lo },
      { col: hi, physPos: hi },
    ];
  }

  // Compute the total physical centre
  const totalRailCols = segs.reduce((acc, s) => acc + s, 0);
  const totalPhysical = totalRailCols + (segs.length - 1) * RAIL_SEGMENT_GAP_EXTRA_PITCHES;
  const centre = (totalPhysical - 1) / 2;
  const fracPhys = x / p + centre;

  // Check which segment the fracPhys falls in; compute corresponding col candidates
  const result: Array<{ col: number; physPos: number }> = [];
  let segOffset = 0; // actual col offset
  let physOffset = 0; // physical pos offset
  for (let i = 0; i < segs.length; i++) {
    const segLen = segs[i];
    const segPhysStart = physOffset;
    const segPhysEnd = physOffset + segLen - 1;
    // Check the two nearest cols in this segment to fracPhys
    const localFrac = fracPhys - segPhysStart;
    const lo = Math.floor(localFrac);
    const hi = lo + 1;
    for (const local of [lo, hi]) {
      if (local >= 0 && local < segLen) {
        result.push({ col: segOffset + local, physPos: segPhysStart + local });
      }
    }
    segOffset += segLen;
    physOffset += segLen + RAIL_SEGMENT_GAP_EXTRA_PITCHES;
    // Also check if fracPhys is near the boundary of this segment and next
    if (i < segs.length - 1) {
      // The gap runs from segPhysEnd+1 to segPhysEnd+RAIL_SEGMENT_GAP_EXTRA_PITCHES
      // which maps to physPos segPhysEnd+1..segPhysEnd+RAIL_SEGMENT_GAP_EXTRA_PITCHES
      // Check the last col of this segment and first col of next segment
      result.push({ col: segOffset - 1, physPos: segPhysEnd });
      result.push({ col: segOffset, physPos: physOffset });
    }
  }

  // Deduplicate
  const seen = new Set<number>();
  return result.filter((r) => {
    if (seen.has(r.col)) return false;
    seen.add(r.col);
    return true;
  });
}

/**
 * Returns the z coordinate for a rail region.
 * TOP_POS is inner (z = outermost MAIN top row - RAIL_OFFSET_PITCHES*p).
 * TOP_NEG is outer (z = TOP_POS - p).
 * BOT_POS is inner (z = outermost MAIN bot row + RAIL_OFFSET_PITCHES*p).
 * BOT_NEG is outer (z = BOT_POS + p).
 */
function railRegionToZ(grid: GridSpec): {
  TOP_POS: number;
  TOP_NEG: number;
  BOT_POS: number;
  BOT_NEG: number;
} {
  const p = grid.pitchMeters;
  const rps = grid.rowsPerSide;

  // Outermost MAIN top row z (row 0)
  const topOuterZ = mainRowToZ(grid, 0);
  // Outermost MAIN bot row z (row 2*rps-1)
  const botOuterZ = mainRowToZ(grid, 2 * rps - 1);

  const TOP_POS = topOuterZ - RAIL_OFFSET_PITCHES * p;
  const TOP_NEG = TOP_POS - p; // outer
  const BOT_POS = botOuterZ + RAIL_OFFSET_PITCHES * p;
  const BOT_NEG = BOT_POS + p; // outer

  return { TOP_POS, TOP_NEG, BOT_POS, BOT_NEG };
}

// ---------------------------------------------------------------------------
// 1.2c-ii: exported functions
// ---------------------------------------------------------------------------

/**
 * Converts a HoleCoord to a board-local 3D position in metres.
 * Returns null for out-of-bounds holes or rail holes when hasPowerRails is false.
 *
 * Frame: origin at board centre on the top surface. +x along cols, +z along rows, y=0.
 */
export function holeToLocal(
  grid: GridSpec,
  hole: HoleCoord
): { x: number; y: 0; z: number } | null {
  if (!isHoleInBounds(grid, hole)) {
    return null;
  }

  if (hole.region === "MAIN") {
    return {
      x: mainColToX(grid, hole.col),
      y: 0,
      z: mainRowToZ(grid, hole.row),
    };
  }

  // Rail region -- isHoleInBounds already checked hasPowerRails
  const railZ = railRegionToZ(grid);
  const z = railZ[hole.region];
  const x = railColToX(grid, hole.col);
  return { x, y: 0, z };
}

/** Region order for deterministic tie-breaking (lower index wins). */
const REGION_ORDER: ReadonlyArray<BreadboardRegion> = [
  "MAIN",
  "TOP_POS",
  "TOP_NEG",
  "BOT_POS",
  "BOT_NEG",
];

/**
 * Finds the nearest in-bounds hole to the board-local point (x, z).
 * Uses analytic inversion -- no loop over all holes.
 *
 * Returns null when:
 *   - x, z are non-finite,
 *   - the point is in the MAIN centre gap,
 *   - all candidate holes are farther than maxRadiusMeters,
 *   - hasPowerRails is false and only rail holes were candidates.
 *
 * Default radius = HIT_RADIUS_PITCHES * grid.pitchMeters.
 * Tie-break: lower region order, then lower col, then lower row.
 */
export function nearestHoleLocal(
  grid: GridSpec,
  x: number,
  z: number,
  maxRadiusMeters?: number
): HoleCoord | null {
  if (!isFinite(x) || !isFinite(z)) {
    return null;
  }

  const p = grid.pitchMeters;
  const radius =
    maxRadiusMeters !== undefined ? maxRadiusMeters : HIT_RADIUS_PITCHES * p;
  const radiusSq = radius * radius;

  let best: HoleCoord | null = null;
  let bestDistSq = Infinity;

  // ---- MAIN region ----
  {
    const rps = grid.rowsPerSide;
    // Candidate col
    const fracCol = x / p + (grid.cols - 1) / 2;
    const colCandidates = [Math.round(fracCol)];
    // Also try floor/ceil so we never miss
    colCandidates.push(Math.floor(fracCol), Math.ceil(fracCol));

    // Candidate rows from inverse z mapping
    const { topFrac, botFrac, inGap } = zToMainRowFracs(grid, z);

    if (inGap) {
      // Point is in centre gap -- return null (checked after all regions, but
      // we skip MAIN entirely and report null only if no rail hole beats it).
      // We still continue to check rails.
      // Mark inGap so we do not emit a MAIN hole below.
    } else {
      // Build row candidates: round + floor + ceil for both top and bottom fracs
      const rowCandidates: number[] = [];
      if (grid.hasCenterGap) {
        // Top side: candidate rows in 0..rps-1
        for (const fr of [topFrac]) {
          rowCandidates.push(Math.round(fr), Math.floor(fr), Math.ceil(fr));
        }
        // Bottom side: candidate rows in rps..2*rps-1
        for (const fr of [botFrac]) {
          rowCandidates.push(Math.round(fr), Math.floor(fr), Math.ceil(fr));
        }
      } else {
        for (const fr of [topFrac]) {
          rowCandidates.push(Math.round(fr), Math.floor(fr), Math.ceil(fr));
        }
      }

      for (let col of colCandidates) {
        if (col < 0 || col >= grid.cols) continue;
        if (col === 0) col = 0;
        const hx = mainColToX(grid, col);
        const dx = x - hx;
        for (let row of rowCandidates) {
          if (row < 0 || row >= 2 * rps) continue;
          if (row === 0) row = 0;
          if (inGap) continue;
          const hz = mainRowToZ(grid, row);
          const dz = z - hz;
          const distSq = dx * dx + dz * dz;
          if (distSq > radiusSq) continue;
          const candidate: HoleCoord = { region: "MAIN", col, row };
          if (isBetter(candidate, distSq, best, bestDistSq)) {
            best = candidate;
            bestDistSq = distSq;
          }
        }
      }
    }
  }

  // ---- Rail regions (only when hasPowerRails) ----
  if (grid.hasPowerRails && grid.railCols !== undefined && grid.railCols > 0) {
    const railZMap = railRegionToZ(grid);
    const railRegions: BreadboardRegion[] = ["TOP_POS", "TOP_NEG", "BOT_POS", "BOT_NEG"];

    const colCandidates = xToRailColCandidates(grid, x);

    for (const region of railRegions) {
      const rz = railZMap[region as keyof typeof railZMap];
      const dz = z - rz;
      if (dz * dz > radiusSq) continue; // z too far from this rail

      for (const { col } of colCandidates) {
        if (col < 0 || col >= grid.railCols) continue;
        const normalizedCol = col === 0 ? 0 : col;
        const hx = railColToX(grid, normalizedCol);
        const dx = x - hx;
        const distSq = dx * dx + dz * dz;
        if (distSq > radiusSq) continue;
        const candidate: HoleCoord = { region, col: normalizedCol, row: 0 };
        if (isBetter(candidate, distSq, best, bestDistSq)) {
          best = candidate;
          bestDistSq = distSq;
        }
      }
    }
  }

  return best;
}

/**
 * Returns true when `candidate` beats the current `best` by distance, then
 * tie-breaking by region order, col, row (ascending).
 */
function isBetter(
  candidate: HoleCoord,
  candidateDistSq: number,
  best: HoleCoord | null,
  bestDistSq: number
): boolean {
  if (best === null) return true;
  const eps = 1e-24; // below any floating-point pitch^2 rounding
  if (candidateDistSq < bestDistSq - eps) return true;
  if (candidateDistSq > bestDistSq + eps) return false;
  // Tie -- apply region order, then col, then row
  const rA = REGION_ORDER.indexOf(candidate.region);
  const rB = REGION_ORDER.indexOf(best.region);
  if (rA !== rB) return rA < rB;
  if (candidate.col !== best.col) return candidate.col < best.col;
  return candidate.row < best.row;
}
