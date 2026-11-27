// ---------------------------------------------------------------------------
// src/utils/breadboardGrid.ts — Canonical Breadboard Grid (Part 1 of 3)
//
// HoleCoord <-> PinAddress formatting/parsing, bounds checks, and strip
// membership per ARCHITECTURE.md §4.1 and §5.5.
// Pure module: no React, Three.js, store, DOM, Math.random, or Date.
// ---------------------------------------------------------------------------

import type {
  BreadboardRegion,
  GridSpec,
  HoleCoord,
  PinAddress,
  SafeId,
} from "@/types/circuit";
import { SAFE_ID_REGEX } from "@/types/persistence";

export interface ParsedHoleAddress {
  boardId: SafeId;
  hole: HoleCoord;
}

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

/**
 * Formats a breadboard hole coordinate into canonical PinAddress form:
 * `"<boardId>:<region>:<col>:<row>"`.
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
 * Parses a canonical breadboard hole address `"<boardId>:<region>:<col>:<row>"`.
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
 * Checks whether `hole` lies within the valid bounds of `grid` per ARCHITECTURE §5.5.
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
 * connected strip per ARCHITECTURE §5.5. Callers must ensure both holes belong to
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
      // ARCHITECTURE §5.5 specifies center gap splitting rows into two sides;
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
