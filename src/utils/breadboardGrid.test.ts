// ---------------------------------------------------------------------------
// src/utils/breadboardGrid.test.ts -- Tests for breadboardGrid.ts (1.2c-i and 1.2c-ii)
// Plain ASCII only in all comments and strings.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type {
  BreadboardRegion,
  GridSpec,
  HoleCoord,
  PinDefinition,
} from "@/types/circuit";
import {
  ANCHOR_TIE_EPS_M,
  areHolesInSameStrip,
  CENTER_GAP_EXTRA_PITCHES,
  formatHoleAddress,
  HIT_RADIUS_PITCHES,
  holeToLocal,
  isHoleInBounds,
  mountedFootprintAabb,
  mountedPinAddresses,
  nearestHoleLocal,
  parseHoleAddress,
  QuarterTurns,
  RAIL_OFFSET_PITCHES,
  RAIL_SEGMENT_GAP_EXTRA_PITCHES,
  rotateAabbXZ,
  rotateOffsetXZ,
  selectAnchorPin,
  SNAP_TOLERANCE_PITCHES,
  translateAabbXZ,
} from "@/utils/breadboardGrid";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const GRID_830: GridSpec = {
  cols: 63,
  rowsPerSide: 5,
  pitchMeters: 0.00254,
  hasCenterGap: true,
  hasPowerRails: true,
  railCols: 50,
  railSegments: [25, 25],
};

const SMALL_GRID: GridSpec = {
  cols: 5,
  rowsPerSide: 2,
  pitchMeters: 0.00254,
  hasCenterGap: true,
  hasPowerRails: true,
  railCols: 10,
  railSegments: [4, 6],
};

const RAIL_REGIONS: readonly BreadboardRegion[] = [
  "TOP_POS",
  "TOP_NEG",
  "BOT_POS",
  "BOT_NEG",
];

function enumerateAllHoles(grid: GridSpec): HoleCoord[] {
  const holes: HoleCoord[] = [];
  for (let col = 0; col < grid.cols; col++) {
    for (let row = 0; row < 2 * grid.rowsPerSide; row++) {
      holes.push({ region: "MAIN", col, row });
    }
  }
  if (grid.hasPowerRails && grid.railCols !== undefined) {
    for (const region of RAIL_REGIONS) {
      for (let col = 0; col < grid.railCols; col++) {
        holes.push({ region, col, row: 0 });
      }
    }
  }
  return holes;
}

// ---------------------------------------------------------------------------
// 1.2c-i tests (preserved unchanged)
// ---------------------------------------------------------------------------

describe("breadboardGrid (1.2c-i)", () => {
  it("(a) round-trips every hole of the 830-point spec", () => {
    const holes = enumerateAllHoles(GRID_830);
    expect(holes).toHaveLength(830);

    for (const hole of holes) {
      const addr = formatHoleAddress("bb_830", hole);
      const parsed = parseHoleAddress(addr);
      expect(parsed).toEqual({ boardId: "bb_830", hole });
    }
  });

  it("(b) formats the documented example exactly and validates formatHoleAddress inputs", () => {
    expect(
      formatHoleAddress("bb_c3d4", { region: "MAIN", col: 12, row: 0 })
    ).toBe("bb_c3d4:MAIN:12:0");

    // Reject invalid boardId
    expect(() =>
      formatHoleAddress("bb:c3d4", { region: "MAIN", col: 0, row: 0 })
    ).toThrow();
    expect(() =>
      formatHoleAddress("", { region: "MAIN", col: 0, row: 0 })
    ).toThrow();
    expect(() =>
      formatHoleAddress("bad id", { region: "MAIN", col: 0, row: 0 })
    ).toThrow();

    // Reject unknown region
    expect(() =>
      formatHoleAddress("bb_c3d4", {
        region: "UNKNOWN" as BreadboardRegion,
        col: 0,
        row: 0,
      })
    ).toThrow();
    expect(() =>
      formatHoleAddress("bb_c3d4", {
        region: "__proto__" as BreadboardRegion,
        col: 0,
        row: 0,
      })
    ).toThrow();

    // Reject col/row that are not non-negative safe integers
    expect(() =>
      formatHoleAddress("bb_c3d4", { region: "MAIN", col: -1, row: 0 })
    ).toThrow();
    expect(() =>
      formatHoleAddress("bb_c3d4", { region: "MAIN", col: 0, row: -1 })
    ).toThrow();
    expect(() =>
      formatHoleAddress("bb_c3d4", { region: "MAIN", col: 1.5, row: 0 })
    ).toThrow();
    expect(() =>
      formatHoleAddress("bb_c3d4", { region: "MAIN", col: Number.NaN, row: 0 })
    ).toThrow();
    expect(() =>
      formatHoleAddress("bb_c3d4", {
        region: "MAIN",
        col: Number.POSITIVE_INFINITY,
        row: 0,
      })
    ).toThrow();
    expect(() =>
      formatHoleAddress("bb_c3d4", {
        region: "MAIN",
        col: Number.MAX_SAFE_INTEGER + 1,
        row: 0,
      })
    ).toThrow();
  });

  it("(c) parseHoleAddress rejects malformed addresses and never throws", () => {
    const malformed = [
      "",
      "uno_a1b2:D13", // 2-segment component pin address
      "bb_c3d4:MAIN:12:0:extra", // extra trailing segment
      "bb_c3d4:MAIN:12", // too few segments
      "bb_c3d4:UNKNOWN:12:0", // unknown region
      "bb_c3d4:__proto__:12:0", // prototype property name
      "bb_c3d4:constructor:12:0", // prototype property name
      "bb_c3d4:toString:12:0", // prototype property name
      ":MAIN:12:0", // empty boardId
      "bb c3d4:MAIN:12:0", // invalid boardId char
      "bb_c3d4:MAIN:01:0", // leading zero
      "bb_c3d4:MAIN:-1:0", // negative
      "bb_c3d4:MAIN:1.5:0", // float
      "bb_c3d4:MAIN:1e2:0", // scientific notation
      "bb_c3d4:MAIN: 3:0", // whitespace
      "bb_c3d4:MAIN::0", // empty col
      "bb_c3d4:MAIN:NaN:0", // NaN
      "bb_c3d4:MAIN:Infinity:0", // Infinity
      "bb_c3d4:MAIN:0:01", // leading zero row
      "bb_c3d4:MAIN:0:-1", // negative row
      "bb_c3d4:MAIN:0:1.5", // float row
      "bb_c3d4:MAIN:123456789012345678901234567890:0", // 30-digit col (> MAX_SAFE_INTEGER)
      "bb_c3d4:MAIN:0:123456789012345678901234567890", // 30-digit row (> MAX_SAFE_INTEGER)
    ];

    for (const addr of malformed) {
      expect(parseHoleAddress(addr)).toBeNull();
    }
  });

  it("(d) checks MAIN bounds accurately", () => {
    expect(isHoleInBounds(GRID_830, { region: "MAIN", col: 0, row: 0 })).toBe(
      true
    );
    expect(
      isHoleInBounds(GRID_830, { region: "MAIN", col: 62, row: 9 })
    ).toBe(true);

    expect(isHoleInBounds(GRID_830, { region: "MAIN", col: -1, row: 0 })).toBe(
      false
    );
    expect(isHoleInBounds(GRID_830, { region: "MAIN", col: 63, row: 0 })).toBe(
      false
    );
    expect(isHoleInBounds(GRID_830, { region: "MAIN", col: 0, row: -1 })).toBe(
      false
    );
    expect(isHoleInBounds(GRID_830, { region: "MAIN", col: 0, row: 10 })).toBe(
      false
    );

    expect(
      isHoleInBounds(GRID_830, { region: "MAIN", col: 1.5, row: 0 })
    ).toBe(false);
    expect(
      isHoleInBounds(GRID_830, { region: "MAIN", col: Number.NaN, row: 0 })
    ).toBe(false);
    expect(
      isHoleInBounds(GRID_830, {
        region: "MAIN",
        col: Number.POSITIVE_INFINITY,
        row: 0,
      })
    ).toBe(false);
  });

  it("(e) checks rail bounds accurately", () => {
    for (const region of RAIL_REGIONS) {
      expect(isHoleInBounds(GRID_830, { region, col: 0, row: 0 })).toBe(true);
      expect(isHoleInBounds(GRID_830, { region, col: 49, row: 0 })).toBe(true);

      expect(isHoleInBounds(GRID_830, { region, col: 0, row: 1 })).toBe(false);
      expect(isHoleInBounds(GRID_830, { region, col: -1, row: 0 })).toBe(false);
      expect(isHoleInBounds(GRID_830, { region, col: 50, row: 0 })).toBe(false);
    }

    const noRailsGrid: GridSpec = {
      ...SMALL_GRID,
      hasPowerRails: false,
      railCols: undefined,
      railSegments: undefined,
    };
    expect(
      isHoleInBounds(noRailsGrid, { region: "TOP_POS", col: 0, row: 0 })
    ).toBe(false);
  });

  it("(f) checks MAIN strip membership with and without center gap", () => {
    // With center gap (830-point spec, rowsPerSide = 5)
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "MAIN", col: 10, row: 0 },
        { region: "MAIN", col: 10, row: 4 }
      )
    ).toBe(true);
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "MAIN", col: 10, row: 4 },
        { region: "MAIN", col: 10, row: 5 }
      )
    ).toBe(false);
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "MAIN", col: 10, row: 0 },
        { region: "MAIN", col: 11, row: 0 }
      )
    ).toBe(false);
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "MAIN", col: 10, row: 5 },
        { region: "MAIN", col: 10, row: 9 }
      )
    ).toBe(true);

    // Without center gap (Option A: all rows 0..2*rowsPerSide-1 in same col are one strip)
    const noGapSmall: GridSpec = { ...SMALL_GRID, hasCenterGap: false };
    expect(
      areHolesInSameStrip(
        noGapSmall,
        { region: "MAIN", col: 2, row: 0 },
        { region: "MAIN", col: 2, row: 3 }
      )
    ).toBe(true);
    expect(
      areHolesInSameStrip(
        noGapSmall,
        { region: "MAIN", col: 2, row: 0 },
        { region: "MAIN", col: 3, row: 0 }
      )
    ).toBe(false);
  });

  it("(g) checks rail strip membership, segments, undefined railSegments, and mismatched sum", () => {
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "TOP_POS", col: 0, row: 0 },
        { region: "TOP_POS", col: 24, row: 0 }
      )
    ).toBe(true);
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "TOP_POS", col: 24, row: 0 },
        { region: "TOP_POS", col: 25, row: 0 }
      )
    ).toBe(false);
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "TOP_POS", col: 10, row: 0 },
        { region: "TOP_NEG", col: 10, row: 0 }
      )
    ).toBe(false);

    // Undefined railSegments treats whole rail as a single strip
    const singleSegmentGrid: GridSpec = {
      ...SMALL_GRID,
      railSegments: undefined,
    };
    expect(
      areHolesInSameStrip(
        singleSegmentGrid,
        { region: "BOT_NEG", col: 0, row: 0 },
        { region: "BOT_NEG", col: 9, row: 0 }
      )
    ).toBe(true);

    // Mismatched railSegments (sum 6 < railCols 10): cols >= 6 get segment -1, must NOT match (-1 === -1)
    const shortSegmentsGrid: GridSpec = {
      ...SMALL_GRID,
      railCols: 10,
      railSegments: [3, 3],
    };
    expect(
      areHolesInSameStrip(
        shortSegmentsGrid,
        { region: "TOP_POS", col: 7, row: 0 },
        { region: "TOP_POS", col: 8, row: 0 }
      )
    ).toBe(false);
  });

  it("(h) out-of-bounds holes and cross-region (MAIN vs rail) are never in the same strip", () => {
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "MAIN", col: -1, row: 0 },
        { region: "MAIN", col: -1, row: 0 }
      )
    ).toBe(false);
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "MAIN", col: 0, row: 0 },
        { region: "MAIN", col: 0, row: 10 }
      )
    ).toBe(false);
    expect(
      areHolesInSameStrip(
        GRID_830,
        { region: "MAIN", col: 0, row: 0 },
        { region: "TOP_POS", col: 0, row: 0 }
      )
    ).toBe(false);
  });

  it("(i) property tests: address round-trip and in-bounds strip reflexivity/symmetry", () => {
    const safeIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,16}$/);
    const mainHoleArb: fc.Arbitrary<HoleCoord> = fc.record({
      region: fc.constant<BreadboardRegion>("MAIN"),
      col: fc.integer({ min: 0, max: GRID_830.cols - 1 }),
      row: fc.integer({ min: 0, max: 2 * GRID_830.rowsPerSide - 1 }),
    });
    const railHoleArb: fc.Arbitrary<HoleCoord> = fc.record({
      region: fc.constantFrom<BreadboardRegion>(...RAIL_REGIONS),
      col: fc.integer({ min: 0, max: (GRID_830.railCols ?? 1) - 1 }),
      row: fc.constant(0),
    });
    const inBoundsHoleArb = fc.oneof(mainHoleArb, railHoleArb);

    fc.assert(
      fc.property(safeIdArb, inBoundsHoleArb, (boardId, hole) => {
        const parsed = parseHoleAddress(formatHoleAddress(boardId, hole));
        expect(parsed).toEqual({ boardId, hole });
      }),
      { seed: 42, numRuns: 200 }
    );

    fc.assert(
      fc.property(inBoundsHoleArb, inBoundsHoleArb, (a, b) => {
        expect(areHolesInSameStrip(GRID_830, a, a)).toBe(true);
        expect(areHolesInSameStrip(GRID_830, a, b)).toBe(
          areHolesInSameStrip(GRID_830, b, a)
        );
      }),
      { seed: 42, numRuns: 200 }
    );
  });

  // 30-DIGIT COL PARSE TEST
  it("(j) parseHoleAddress rejects 30-digit col (> MAX_SAFE_INTEGER)", () => {
    const bigCol = "bb_1:MAIN:" + "1" + "0".repeat(29) + ":0";
    expect(parseHoleAddress(bigCol)).toBeNull();
    // Also reject non-integer, negative, empty, leading-plus
    expect(parseHoleAddress("bb_1:MAIN:1.5:0")).toBeNull();
    expect(parseHoleAddress("bb_1:MAIN:-1:0")).toBeNull();
    expect(parseHoleAddress("bb_1:MAIN::0")).toBeNull();
    expect(parseHoleAddress("bb_1:MAIN:+1:0")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 1.2c-ii tests
// ---------------------------------------------------------------------------

describe("breadboardGrid (1.2c-ii) holeToLocal and nearestHoleLocal", () => {

  // ---- (A) 830-point round-trip ----
  it("(A) round-trip: nearestHoleLocal(holeToLocal(h)) === h for all 830 holes", () => {
    const holes = enumerateAllHoles(GRID_830);
    expect(holes).toHaveLength(830);

    for (const h of holes) {
      const pos = holeToLocal(GRID_830, h);
      expect(pos).not.toBeNull();
      if (pos === null) continue;
      const found = nearestHoleLocal(GRID_830, pos.x, pos.z);
      expect(found).toEqual(h);
    }
  });

  // ---- (B) Centre-gap spacing ----
  it("(B) centre-gap spacing is exactly (1+CENTER_GAP_EXTRA_PITCHES)*pitch", () => {
    const p = GRID_830.pitchMeters;
    const rps = GRID_830.rowsPerSide;
    // innermost top row: rps-1; innermost bottom row: rps
    const posInner = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: rps - 1 });
    const posOuter = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: rps });
    expect(posInner).not.toBeNull();
    expect(posOuter).not.toBeNull();
    if (!posInner || !posOuter) return;
    const gap = posOuter.z - posInner.z;
    expect(gap).toBeCloseTo((1 + CENTER_GAP_EXTRA_PITCHES) * p, 10);
  });

  it("(B2) adjacent rows within one side are exactly 1 pitch apart", () => {
    const p = GRID_830.pitchMeters;
    for (let row = 0; row < GRID_830.rowsPerSide - 1; row++) {
      const a = holeToLocal(GRID_830, { region: "MAIN", col: 0, row });
      const b = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: row + 1 });
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      if (!a || !b) return;
      expect(Math.abs(b.z - a.z)).toBeCloseTo(p, 10);
    }
    // Bottom side
    for (let row = GRID_830.rowsPerSide; row < 2 * GRID_830.rowsPerSide - 1; row++) {
      const a = holeToLocal(GRID_830, { region: "MAIN", col: 0, row });
      const b = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: row + 1 });
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      if (!a || !b) return;
      expect(Math.abs(b.z - a.z)).toBeCloseTo(p, 10);
    }
  });

  // ---- (C) hasCenterGap false: no extra spacing ----
  it("(C) hasCenterGap=false: no extra spacing, round trip exact", () => {
    const noGap: GridSpec = { ...GRID_830, hasCenterGap: false };
    const p = noGap.pitchMeters;
    const rps = noGap.rowsPerSide;
    // All adjacent rows should be exactly 1 pitch apart
    for (let row = 0; row < 2 * rps - 1; row++) {
      const a = holeToLocal(noGap, { region: "MAIN", col: 0, row });
      const b = holeToLocal(noGap, { region: "MAIN", col: 0, row: row + 1 });
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      if (!a || !b) return;
      expect(Math.abs(b.z - a.z)).toBeCloseTo(p, 10);
    }
    // Round trip
    const holes = enumerateAllHoles(noGap);
    for (const h of holes) {
      if (h.region !== "MAIN") continue;
      const pos = holeToLocal(noGap, h);
      expect(pos).not.toBeNull();
      if (!pos) continue;
      const found = nearestHoleLocal(noGap, pos.x, pos.z);
      expect(found).toEqual(h);
    }
  });

  // ---- (D) Rail segment gap ----
  it("(D) rail segment gap: last col of seg 0 to first col of seg 1 is (1+RAIL_SEGMENT_GAP_EXTRA_PITCHES)*pitch", () => {
    const p = GRID_830.pitchMeters;
    // railSegments = [25, 25]; last col of seg 0 = col 24, first col of seg 1 = col 25
    const a = holeToLocal(GRID_830, { region: "TOP_POS", col: 24, row: 0 });
    const b = holeToLocal(GRID_830, { region: "TOP_POS", col: 25, row: 0 });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b) return;
    expect(b.x - a.x).toBeCloseTo((1 + RAIL_SEGMENT_GAP_EXTRA_PITCHES) * p, 10);
  });

  // ---- (E) Rail offset ----
  it("(E) rail offset: distance from outermost MAIN row to nearest rail row equals RAIL_OFFSET_PITCHES*pitch", () => {
    const p = GRID_830.pitchMeters;
    // TOP_POS is the inner (nearest) top rail; outermost top MAIN row is row 0
    const mainTop = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: 0 });
    const railTopPos = holeToLocal(GRID_830, { region: "TOP_POS", col: 0, row: 0 });
    expect(mainTop).not.toBeNull();
    expect(railTopPos).not.toBeNull();
    if (!mainTop || !railTopPos) return;
    expect(mainTop.z - railTopPos.z).toBeCloseTo(RAIL_OFFSET_PITCHES * p, 10);

    // BOT_POS is the inner (nearest) bottom rail; outermost bottom MAIN row is row 2*rps-1
    const rps = GRID_830.rowsPerSide;
    const mainBot = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: 2 * rps - 1 });
    const railBotPos = holeToLocal(GRID_830, { region: "BOT_POS", col: 0, row: 0 });
    expect(mainBot).not.toBeNull();
    expect(railBotPos).not.toBeNull();
    if (!mainBot || !railBotPos) return;
    expect(railBotPos.z - mainBot.z).toBeCloseTo(RAIL_OFFSET_PITCHES * p, 10);
  });

  // ---- (F) Null cases ----
  it("(F) point in centre gap returns null", () => {
    const p = GRID_830.pitchMeters;
    const rps = GRID_830.rowsPerSide;
    // The midpoint of the gap
    const inner = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: rps - 1 });
    const outer = holeToLocal(GRID_830, { region: "MAIN", col: 0, row: rps });
    expect(inner).not.toBeNull();
    expect(outer).not.toBeNull();
    if (!inner || !outer) return;
    const gapMidZ = (inner.z + outer.z) / 2;
    // Set x to board centre so it is not near any col edge
    const result = nearestHoleLocal(GRID_830, 0, gapMidZ, 0.3 * p);
    expect(result).toBeNull();
  });

  it("(F2) point beyond radius returns null", () => {
    const p = GRID_830.pitchMeters;
    const h: HoleCoord = { region: "MAIN", col: 31, row: 2 };
    const pos = holeToLocal(GRID_830, h);
    expect(pos).not.toBeNull();
    if (!pos) return;
    // A point displaced 0.49*p in both x and z from pos, so its distance to pos
    // is sqrt(0.49^2 + 0.49^2)*p ~= 0.693*p > HIT_RADIUS_PITCHES=0.45.
    // The nearest holes (at corners ~0.693*p away) are all beyond the radius.
    const qx = pos.x + 0.49 * p;
    const qz = pos.z + 0.49 * p;
    const result = nearestHoleLocal(GRID_830, qx, qz);
    expect(result).toBeNull();
  });

  it("(F3) NaN input returns null", () => {
    expect(nearestHoleLocal(GRID_830, Number.NaN, 0)).toBeNull();
    expect(nearestHoleLocal(GRID_830, 0, Number.NaN)).toBeNull();
    expect(nearestHoleLocal(GRID_830, Number.POSITIVE_INFINITY, 0)).toBeNull();
    expect(nearestHoleLocal(GRID_830, 0, Number.NEGATIVE_INFINITY)).toBeNull();
  });

  // ---- (G) hasPowerRails false ----
  it("(G) hasPowerRails=false: rail holes return null from holeToLocal and are never returned by hit test", () => {
    const noRails: GridSpec = {
      ...GRID_830,
      hasPowerRails: false,
      railCols: undefined,
      railSegments: undefined,
    };
    for (const region of RAIL_REGIONS) {
      expect(holeToLocal(noRails, { region, col: 0, row: 0 })).toBeNull();
    }
    // Hit-test at the z that would be TOP_POS on the full grid
    const railPos = holeToLocal(GRID_830, { region: "TOP_POS", col: 0, row: 0 });
    expect(railPos).not.toBeNull();
    if (!railPos) return;
    const hit = nearestHoleLocal(noRails, railPos.x, railPos.z);
    // Should be null or a MAIN hole, never a rail hole
    if (hit !== null) {
      expect(hit.region).toBe("MAIN");
    }
  });

  // ---- (H) Scale tests ----
  it("(H) scale test: round trip exact for pitchMeters=0.00254 and 0.0254", () => {
    for (const pitch of [0.00254, 0.0254]) {
      const grid: GridSpec = { ...GRID_830, pitchMeters: pitch };
      const holes = enumerateAllHoles(grid);
      for (const h of holes) {
        const pos = holeToLocal(grid, h);
        expect(pos).not.toBeNull();
        if (!pos) continue;
        const found = nearestHoleLocal(grid, pos.x, pos.z);
        expect(found).toEqual(h);
      }
    }
  });

  it("(H2) scale test: default radius scales with pitchMeters", () => {
    for (const pitch of [0.00254, 0.0254]) {
      const grid: GridSpec = { ...GRID_830, pitchMeters: pitch };
      // col 0 has no neighbours in the negative x direction
      const h: HoleCoord = { region: "MAIN", col: 0, row: 2 };
      const pos = holeToLocal(grid, h);
      expect(pos).not.toBeNull();
      if (!pos) continue;

      // Inside radius: (HIT_RADIUS_PITCHES - 0.02) * pitch away along x
      const insideX = pos.x - (HIT_RADIUS_PITCHES - 0.02) * pitch;
      const found = nearestHoleLocal(grid, insideX, pos.z);
      expect(found).toEqual(h);

      // Outside radius: (HIT_RADIUS_PITCHES + 0.02) * pitch away along x
      const outsideX = pos.x - (HIT_RADIUS_PITCHES + 0.02) * pitch;
      const missed = nearestHoleLocal(grid, outsideX, pos.z);
      expect(missed).toBeNull();
    }
  });

  // ---- (I) Hit-test slightly off-centre ----
  it("(I) hit-test at 0.3*pitch offset still resolves to the right hole", () => {
    const p = GRID_830.pitchMeters;
    const holes = enumerateAllHoles(GRID_830);
    // Test a sample of holes
    const sample = holes.filter((_, i) => i % 50 === 0);
    for (const h of sample) {
      const pos = holeToLocal(GRID_830, h);
      expect(pos).not.toBeNull();
      if (!pos) continue;
      const found = nearestHoleLocal(GRID_830, pos.x + 0.3 * p, pos.z + 0.0 * p);
      expect(found).toEqual(h);
      const found2 = nearestHoleLocal(GRID_830, pos.x, pos.z + 0.3 * p);
      expect(found2).toEqual(h);
    }
  });

  // ---- (J) fast-check property ----
  it("(J) property: for random in-bounds holes, nearestHoleLocal(holeToLocal(h)) equals h", () => {
    const mainHoleArb: fc.Arbitrary<HoleCoord> = fc.record({
      region: fc.constant<BreadboardRegion>("MAIN"),
      col: fc.integer({ min: 0, max: GRID_830.cols - 1 }),
      row: fc.integer({ min: 0, max: 2 * GRID_830.rowsPerSide - 1 }),
    });
    const railHoleArb: fc.Arbitrary<HoleCoord> = fc.record({
      region: fc.constantFrom<BreadboardRegion>(...RAIL_REGIONS),
      col: fc.integer({ min: 0, max: (GRID_830.railCols ?? 1) - 1 }),
      row: fc.constant(0),
    });
    const inBoundsHoleArb = fc.oneof(mainHoleArb, railHoleArb);

    fc.assert(
      fc.property(inBoundsHoleArb, (h) => {
        const pos = holeToLocal(GRID_830, h);
        expect(pos).not.toBeNull();
        if (!pos) return;
        const found = nearestHoleLocal(GRID_830, pos.x, pos.z);
        expect(found).toEqual(h);
      }),
      { seed: 123, numRuns: 300 }
    );
  });

  // ---- (K) holeToLocal y is always 0 ----
  it("(K) holeToLocal always returns y=0", () => {
    const holes = enumerateAllHoles(GRID_830);
    for (const h of holes) {
      const pos = holeToLocal(GRID_830, h);
      if (pos) {
        expect(pos.y).toBe(0);
      }
    }
  });

  // ---- (L) OUT_NEG is outer than TOP_POS ----
  it("(L) TOP_NEG is outer (more negative z) than TOP_POS; BOT_NEG is outer (more positive z) than BOT_POS", () => {
    const topPos = holeToLocal(GRID_830, { region: "TOP_POS", col: 0, row: 0 });
    const topNeg = holeToLocal(GRID_830, { region: "TOP_NEG", col: 0, row: 0 });
    const botPos = holeToLocal(GRID_830, { region: "BOT_POS", col: 0, row: 0 });
    const botNeg = holeToLocal(GRID_830, { region: "BOT_NEG", col: 0, row: 0 });
    expect(topPos).not.toBeNull();
    expect(topNeg).not.toBeNull();
    expect(botPos).not.toBeNull();
    expect(botNeg).not.toBeNull();
    if (!topPos || !topNeg || !botPos || !botNeg) return;
    // TOP: more negative z = outer
    expect(topNeg.z).toBeLessThan(topPos.z);
    // BOT: more positive z = outer
    expect(botNeg.z).toBeGreaterThan(botPos.z);
    // TOP_POS and TOP_NEG are 1 pitch apart
    expect(topPos.z - topNeg.z).toBeCloseTo(GRID_830.pitchMeters, 10);
    // BOT_POS and BOT_NEG are 1 pitch apart
    expect(botNeg.z - botPos.z).toBeCloseTo(GRID_830.pitchMeters, 10);
  });
});

// ---------------------------------------------------------------------------
// 1.2c-iii tests: rotation, anchor selection, mounted pin snapping, AABB
// ---------------------------------------------------------------------------

describe("breadboardGrid (1.2c-iii)", () => {
  // Helper to create minimal PinDefinition for testing
  function makePin(
    id: string,
    x: number,
    z: number,
    y = 0
  ): PinDefinition {
    return {
      id,
      label: id,
      type: "GPIO",
      localPosition: [x, y, z],
      normal: [0, 1, 0],
      allowedModes: ["INPUT", "OUTPUT_DIGITAL"],
      defaultMode: "INPUT",
      logicHighV: 5,
      maxVoltage: 5.5,
      maxCurrentMa: 20,
      internalOhm: 25,
    };
  }

  // 1. Rotation table: offset (2, 3) -> k0 (2,3), k1 (3,-2), k2 (-2,-3), k3 (-3,2)
  describe("rotateOffsetXZ", () => {
    it("matches the exact rotation table for (2, 3)", () => {
      expect(rotateOffsetXZ(2, 3, 0)).toEqual({ x: 2, z: 3 });
      expect(rotateOffsetXZ(2, 3, 1)).toEqual({ x: 3, z: -2 });
      expect(rotateOffsetXZ(2, 3, 2)).toEqual({ x: -2, z: -3 });
      expect(rotateOffsetXZ(2, 3, 3)).toEqual({ x: -3, z: 2 });
    });

    it("matches three.js matrix formula for several offsets and normalises -0 to 0", () => {
      // Inline reference using Three.js rotation matrix about Y:
      // In Three.js: R_y(theta) * [x, 0, z]^T:
      //   x' = x * cos(t) + z * sin(t)
      //   z' = -x * sin(t) + z * cos(t)
      function threeRef(x: number, z: number, k: number): { x: number; z: number } {
        const theta = k * (Math.PI / 2);
        const rx = x * Math.cos(theta) + z * Math.sin(theta);
        const rz = -x * Math.sin(theta) + z * Math.cos(theta);
        const roundX = Math.round(rx * 1e9) / 1e9;
        const roundZ = Math.round(rz * 1e9) / 1e9;
        return {
          x: roundX === 0 ? 0 : roundX,
          z: roundZ === 0 ? 0 : roundZ,
        };
      }

      const sampleOffsets = [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
        [2.54, 7.62],
        [-3.81, 5.08],
        [-10, -20],
      ];

      for (const [x, z] of sampleOffsets) {
        for (let k = 0; k < 4; k++) {
          const res = rotateOffsetXZ(x, z, k);
          const ref = threeRef(x, z, k);
          expect(res.x).toBeCloseTo(ref.x, 6);
          expect(res.z).toBeCloseTo(ref.z, 6);
          // Check no -0 output
          expect(Object.is(res.x, -0)).toBe(false);
          expect(Object.is(res.z, -0)).toBe(false);
        }
      }
    });

    it("four k=1 rotations return the original offset", () => {
      const orig = { x: 12.345, z: -67.89 };
      let cur = orig;
      for (let i = 0; i < 4; i++) {
        cur = rotateOffsetXZ(cur.x, cur.z, 1);
      }
      expect(cur.x).toBe(orig.x);
      expect(cur.z).toBe(orig.z);
    });

    it("throws on invalid quarterTurns", () => {
      expect(() => rotateOffsetXZ(1, 1, 4)).toThrow();
      expect(() => rotateOffsetXZ(1, 1, -1)).toThrow();
      expect(() => rotateOffsetXZ(1, 1, 1.5)).toThrow();
      expect(() => rotateOffsetXZ(1, 1, NaN)).toThrow();
    });
  });

  // 2. Anchor selection
  describe("selectAnchorPin", () => {
    it("returns null for empty pin list", () => {
      expect(selectAnchorPin([])).toBeNull();
    });

    it("smallest x wins", () => {
      const p1 = makePin("p1", 0.01, 0);
      const p2 = makePin("p2", -0.005, 0);
      const p3 = makePin("p3", 0.02, 0);
      expect(selectAnchorPin([p1, p2, p3])).toBe(p2);
      expect(selectAnchorPin([p3, p2, p1])).toBe(p2);
    });

    it("x tie within ANCHOR_TIE_EPS_M breaks to smallest z", () => {
      const p1 = makePin("p1", 0.01, 0.02);
      const p2 = makePin("p2", 0.01 + ANCHOR_TIE_EPS_M * 0.5, -0.01);
      const p3 = makePin("p3", 0.01, 0.05);
      expect(selectAnchorPin([p1, p2, p3])).toBe(p2);
    });

    it("full (x, z) tie breaks to smaller id with plain code-unit comparison (< and >)", () => {
      const pB = makePin("pin_b", 0.01, 0.01);
      const pA = makePin("pin_a", 0.01, 0.01);
      const pZ = makePin("pin_z", 0.01, 0.01);
      expect(selectAnchorPin([pB, pA, pZ])).toBe(pA);
      expect(selectAnchorPin([pZ, pB, pA])).toBe(pA);
    });

    it("order of input array does not change the result", () => {
      const pins = [
        makePin("d", 0.002, 0.001),
        makePin("a", 0.001, 0.005),
        makePin("b", 0.001, 0.002),
        makePin("c", 0.001, 0.002), // ties with b on (x,z), b < c
      ];
      // b has smallest x (0.001), smallest z (0.002), and b < c
      const p1 = selectAnchorPin(pins);
      const p2 = selectAnchorPin([pins[3], pins[0], pins[2], pins[1]]);
      const p3 = selectAnchorPin([pins[2], pins[1], pins[0], pins[3]]);
      expect(p1?.id).toBe("b");
      expect(p2?.id).toBe("b");
      expect(p3?.id).toBe("b");
    });
  });

  // 3. 2x3 DIP-like part at pitch spacing, anchored on MAIN col 10
  describe("mountedPinAddresses: 2x3 DIP part", () => {
    const p = GRID_830.pitchMeters;
    // 2 columns (x = 0, p), 3 rows (z = 0, p, 2*p)
    // Pins:
    //   p1: (0, 0)   -> anchor pin (smallest x, smallest z)
    //   p2: (0, p)
    //   p3: (0, 2*p)
    //   p4: (p, 0)
    //   p5: (p, p)
    //   p6: (p, 2*p)
    const dipPins = [
      makePin("p1", 0, 0),
      makePin("p2", 0, p),
      makePin("p3", 0, 2 * p),
      makePin("p4", p, 0),
      makePin("p5", p, p),
      makePin("p6", p, 2 * p),
    ];

    it("anchors at MAIN col 10 row 0 with k=0 and k=1 matching hand-derived addresses", () => {
      const anchorHole: HoleCoord = { region: "MAIN", col: 10, row: 0 };

      // k = 0 (unrotated):
      // Offset from anchor (0,0):
      // p1: (0, 0)     -> col 10, row 0
      // p2: (0, p)     -> col 10, row 1
      // p3: (0, 2*p)   -> col 10, row 2
      // p4: (p, 0)     -> col 11, row 0
      // p5: (p, p)     -> col 11, row 1
      // p6: (p, 2*p)   -> col 11, row 2
      const resK0 = mountedPinAddresses(GRID_830, "bb_test", dipPins, anchorHole, 0);
      expect(resK0.ok).toBe(true);
      if (resK0.ok) {
        expect(resK0.addresses).toEqual({
          p1: "bb_test:MAIN:10:0",
          p2: "bb_test:MAIN:10:1",
          p3: "bb_test:MAIN:10:2",
          p4: "bb_test:MAIN:11:0",
          p5: "bb_test:MAIN:11:1",
          p6: "bb_test:MAIN:11:2",
        });
      }

      // k = 1 (rotated 90 deg: (dx, dz) -> (dz, -dx)):
      // p1 (0, 0)   -> (0, 0)   -> col 10, row 0
      // p2 (0, p)   -> (p, 0)   -> col 11, row 0
      // p3 (0, 2*p) -> (2*p, 0) -> col 12, row 0
      // p4 (p, 0)   -> (0, -p)  -> row 0 - 1 = off grid in negative z!
      // To test k=1 with all in bounds, anchor at col 10, row 2:
      const anchorHoleK1: HoleCoord = { region: "MAIN", col: 10, row: 2 };
      // p1 (0, 0)   -> (0, 0)   -> col 10, row 2
      // p2 (0, p)   -> (p, 0)   -> col 11, row 2
      // p3 (0, 2*p) -> (2*p, 0) -> col 12, row 2
      // p4 (p, 0)   -> (0, -p)  -> col 10, row 1
      // p5 (p, p)   -> (p, -p)  -> col 11, row 1
      // p6 (p, 2*p) -> (2*p, -p)-> col 12, row 1
      const resK1 = mountedPinAddresses(GRID_830, "bb_test", dipPins, anchorHoleK1, 1);
      expect(resK1.ok).toBe(true);
      if (resK1.ok) {
        expect(resK1.addresses).toEqual({
          p1: "bb_test:MAIN:10:2",
          p2: "bb_test:MAIN:11:2",
          p3: "bb_test:MAIN:12:2",
          p4: "bb_test:MAIN:10:1",
          p5: "bb_test:MAIN:11:1",
          p6: "bb_test:MAIN:12:1",
        });
      }
    });

    it("verifies k=2 and k=3 derived from rotation table", () => {
      // k = 2 ((dx, dz) -> (-dx, -dz)):
      // Anchoring at col 12, row 3:
      // p1 (0, 0)   -> col 12, row 3
      // p2 (0, p)   -> col 12, row 2
      // p3 (0, 2*p) -> col 12, row 1
      // p4 (p, 0)   -> col 11, row 3
      // p5 (p, p)   -> col 11, row 2
      // p6 (p, 2*p) -> col 11, row 1
      const anchorK2: HoleCoord = { region: "MAIN", col: 12, row: 3 };
      const resK2 = mountedPinAddresses(GRID_830, "bb_test", dipPins, anchorK2, 2);
      expect(resK2.ok).toBe(true);
      if (resK2.ok) {
        expect(resK2.addresses).toEqual({
          p1: "bb_test:MAIN:12:3",
          p2: "bb_test:MAIN:12:2",
          p3: "bb_test:MAIN:12:1",
          p4: "bb_test:MAIN:11:3",
          p5: "bb_test:MAIN:11:2",
          p6: "bb_test:MAIN:11:1",
        });
      }

      // k = 3 ((dx, dz) -> (-dz, dx)):
      // Anchoring at col 12, row 0:
      // p1 (0, 0)   -> (0, 0)   -> col 12, row 0
      // p2 (0, p)   -> (-p, 0)  -> col 11, row 0
      // p3 (0, 2*p) -> (-2*p, 0)-> col 10, row 0
      // p4 (p, 0)   -> (0, p)   -> col 12, row 1
      // p5 (p, p)   -> (-p, p)  -> col 11, row 1
      // p6 (p, 2*p) -> (-2*p, p)-> col 10, row 1
      const anchorK3: HoleCoord = { region: "MAIN", col: 12, row: 0 };
      const resK3 = mountedPinAddresses(GRID_830, "bb_test", dipPins, anchorK3, 3);
      expect(resK3.ok).toBe(true);
      if (resK3.ok) {
        expect(resK3.addresses).toEqual({
          p1: "bb_test:MAIN:12:0",
          p2: "bb_test:MAIN:11:0",
          p3: "bb_test:MAIN:10:0",
          p4: "bb_test:MAIN:12:1",
          p5: "bb_test:MAIN:11:1",
          p6: "bb_test:MAIN:10:1",
        });
      }
    });
  });

  // 4. DIP straddling the centre gap (pin rows 3 pitches apart in z) lands on rows rowsPerSide-1 and rowsPerSide
  describe("DIP straddling centre gap", () => {
    it("lands on rows rowsPerSide-1 and rowsPerSide across center gap", () => {
      const p = GRID_830.pitchMeters;
      // In GRID_830, rowsPerSide = 5.
      // Top innermost row is row 4 (rowsPerSide-1).
      // Bottom innermost row is row 5 (rowsPerSide).
      // The physical step between row 4 and row 5 is (1 + CENTER_GAP_EXTRA_PITCHES) * p = 3 * p.
      // A standard DIP with pins 0.3 in (3 pitches) apart in z:
      const dipGapPins = [
        makePin("pinA", 0, 0), // Anchor at row 4
        makePin("pinB", 0, 3 * p), // Offset by 3 pitches in z
      ];

      const anchorHole: HoleCoord = { region: "MAIN", col: 10, row: 4 };
      const res = mountedPinAddresses(GRID_830, "bb_830", dipGapPins, anchorHole, 0);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.addresses["pinA"]).toBe("bb_830:MAIN:10:4");
        expect(res.addresses["pinB"]).toBe("bb_830:MAIN:10:5");
      }
    });
  });

  // 5. Tolerance boundary: 0.24 pitch snaps, 0.26 pitch fails with PIN_OFF_GRID
  describe("snap tolerance boundary", () => {
    it("exports SNAP_TOLERANCE_PITCHES as 0.25", () => {
      expect(SNAP_TOLERANCE_PITCHES).toBe(0.25);
    });

    it("snaps at 0.24 pitch, fails at 0.26 pitch (checked at two pitchMeters values)", () => {
      const pitches = [0.00254, 0.001];

      for (const pitch of pitches) {
        const grid: GridSpec = {
          ...GRID_830,
          pitchMeters: pitch,
        };

        const anchorHole: HoleCoord = { region: "MAIN", col: 10, row: 2 };

        // 0.24 pitch offset
        const pinsSnap = [
          makePin("p_anchor", 0, 0),
          makePin("p_test", pitch + 0.24 * pitch, 0),
        ];
        const resSnap = mountedPinAddresses(grid, "bb_test", pinsSnap, anchorHole, 0);
        expect(resSnap.ok).toBe(true);
        if (resSnap.ok) {
          expect(resSnap.addresses["p_test"]).toBe("bb_test:MAIN:11:2");
        }

        // 0.26 pitch offset
        const pinsFail = [
          makePin("p_anchor", 0, 0),
          makePin("p_test", pitch + 0.26 * pitch, 0),
        ];
        const resFail = mountedPinAddresses(grid, "bb_test", pinsFail, anchorHole, 0);
        expect(resFail.ok).toBe(false);
        if (!resFail.ok) {
          expect(resFail.reason).toBe("PIN_OFF_GRID");
          expect(resFail.pinId).toBe("p_test");
        }
      }
    });
  });

  // 6. Error cases: PIN_COLLISION, ANCHOR_OUT_OF_BOUNDS, NO_PINS, BAD_QUARTER_TURNS,
  //    pin in centre gap, pin past board edge, rail pin with hasPowerRails false
  describe("mountedPinAddresses error cases", () => {
    const p = GRID_830.pitchMeters;

    it("detects PIN_COLLISION when two pins resolve to the same hole", () => {
      // Anchor pin at 0, second pin at offset 0.1*p (snaps to anchor hole)
      const pins = [
        makePin("p1", 0, 0),
        makePin("p2", 0.1 * p, 0),
      ];
      const anchorHole: HoleCoord = { region: "MAIN", col: 5, row: 2 };
      const res = mountedPinAddresses(GRID_830, "bb", pins, anchorHole, 0);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("PIN_COLLISION");
        expect(res.pinId).toBe("p2");
      }
    });

    it("detects ANCHOR_OUT_OF_BOUNDS", () => {
      const pins = [makePin("p1", 0, 0)];
      const badAnchor: HoleCoord = { region: "MAIN", col: 99, row: 0 };
      const res = mountedPinAddresses(GRID_830, "bb", pins, badAnchor, 0);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("ANCHOR_OUT_OF_BOUNDS");
      }
    });

    it("detects NO_PINS", () => {
      const anchorHole: HoleCoord = { region: "MAIN", col: 5, row: 2 };
      const res = mountedPinAddresses(GRID_830, "bb", [], anchorHole, 0);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("NO_PINS");
      }
    });

    it("detects BAD_QUARTER_TURNS (1.5, -1, 4, NaN)", () => {
      const pins = [makePin("p1", 0, 0)];
      const anchorHole: HoleCoord = { region: "MAIN", col: 5, row: 2 };

      for (const badK of [1.5, -1, 4, NaN]) {
        const res = mountedPinAddresses(GRID_830, "bb", pins, anchorHole, badK as QuarterTurns);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.reason).toBe("BAD_QUARTER_TURNS");
        }
      }
    });

    it("detects PIN_OFF_GRID when a pin lands in the centre gap", () => {
      // Row 4 is top-inner. Centre gap is at +1.5*p in z.
      const pins = [
        makePin("p_anchor", 0, 0),
        makePin("p_gap", 0, 1.5 * p),
      ];
      const anchorHole: HoleCoord = { region: "MAIN", col: 5, row: 4 };
      const res = mountedPinAddresses(GRID_830, "bb", pins, anchorHole, 0);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("PIN_OFF_GRID");
        expect(res.pinId).toBe("p_gap");
      }
    });

    it("detects PIN_OFF_GRID when a pin lands past the board edge", () => {
      // Col 62 is the last col. Pin at +1*p along x goes past col 62.
      const pins = [
        makePin("p_anchor", 0, 0),
        makePin("p_outside", p, 0),
      ];
      const anchorHole: HoleCoord = { region: "MAIN", col: 62, row: 2 };
      const res = mountedPinAddresses(GRID_830, "bb", pins, anchorHole, 0);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("PIN_OFF_GRID");
        expect(res.pinId).toBe("p_outside");
      }
    });

    it("detects PIN_OFF_GRID when a pin would land on rails but hasPowerRails is false", () => {
      const gridNoRails: GridSpec = {
        ...GRID_830,
        hasPowerRails: false,
      };
      // Row 0 is outermost top MAIN row. TOP_POS is at -RAIL_OFFSET_PITCHES * p.
      const pins = [
        makePin("p_anchor", 0, 0),
        makePin("p_rail", 0, -RAIL_OFFSET_PITCHES * p),
      ];
      const anchorHole: HoleCoord = { region: "MAIN", col: 5, row: 0 };
      const res = mountedPinAddresses(gridNoRails, "bb", pins, anchorHole, 0);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("PIN_OFF_GRID");
      }
    });
  });

  // 7. Anchor pin address always equals formatHoleAddress of anchorHole
  describe("anchor pin address invariant", () => {
    it("anchor pin address always equals formatHoleAddress(boardId, anchorHole)", () => {
      const p = GRID_830.pitchMeters;
      const pins = [
        makePin("c", 0, 0),
        makePin("b", 0, p),
        makePin("a", p, 0),
      ];
      // Anchor pin is 'c' (x=0, z=0)
      const anchorHole: HoleCoord = { region: "MAIN", col: 15, row: 3 };
      const expectedAddr = formatHoleAddress("my_board", anchorHole);

      for (let k = 0; k < 4; k++) {
        const res = mountedPinAddresses(GRID_830, "my_board", pins, anchorHole, k);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.addresses["c"]).toBe(expectedAddr);
        }
      }
    });
  });

  // 8. rotateAabbXZ for 0/90/180/270 on a non-square rect with an off-centre pivot
  describe("rotateAabbXZ and mountedFootprintAabb", () => {
    it("rotates non-square rect about off-centre pivot, swapping width and height at k=1 and k=3", () => {
      // Box: x in [2, 6] (width = 4), z in [10, 16] (depth = 6)
      const box = { minX: 2, maxX: 6, minZ: 10, maxZ: 16 };
      // Off-centre pivot: (x=3, z=11)
      const pivot = { x: 3, z: 11 };

      // Relative corners: (c.x - 3, c.z - 11):
      // (2,10) -> (-1, -1)
      // (6,10) -> ( 3, -1)
      // (2,16) -> (-1,  5)
      // (6,16) -> ( 3,  5)

      // k = 0: unrotated -> original box
      const r0 = rotateAabbXZ(box, 0, pivot);
      expect(r0).toEqual(box);
      expect(r0.maxX - r0.minX).toBe(4);
      expect(r0.maxZ - r0.minZ).toBe(6);

      // k = 1: (dx, dz) -> (dz, -dx)
      // (-1, -1) -> (-1, 1) -> world: (2, 12)
      // ( 3, -1) -> (-1, -3)-> world: (2, 8)
      // (-1,  5) -> ( 5, 1) -> world: (8, 12)
      // ( 3,  5) -> ( 5, -3)-> world: (8, 8)
      // minX = 2, maxX = 8 (width = 6)
      // minZ = 8, maxZ = 12 (depth = 4)
      const r1 = rotateAabbXZ(box, 1, pivot);
      expect(r1).toEqual({ minX: 2, maxX: 8, minZ: 8, maxZ: 12 });
      expect(r1.maxX - r1.minX).toBe(6);
      expect(r1.maxZ - r1.minZ).toBe(4);

      // k = 2: (dx, dz) -> (-dx, -dz)
      // (-1, -1) -> ( 1,  1) -> world: (4, 12)
      // ( 3, -1) -> (-3,  1) -> world: (0, 12)
      // (-1,  5) -> ( 1, -5) -> world: (4, 6)
      // ( 3,  5) -> (-3, -5) -> world: (0, 6)
      // minX = 0, maxX = 4 (width = 4)
      // minZ = 6, maxZ = 12 (depth = 6)
      const r2 = rotateAabbXZ(box, 2, pivot);
      expect(r2).toEqual({ minX: 0, maxX: 4, minZ: 6, maxZ: 12 });
      expect(r2.maxX - r2.minX).toBe(4);
      expect(r2.maxZ - r2.minZ).toBe(6);

      // k = 3: (dx, dz) -> (-dz, dx)
      // (-1, -1) -> ( 1, -1) -> world: (4, 10)
      // ( 3, -1) -> ( 1,  3) -> world: (4, 14)
      // (-1,  5) -> (-5, -1) -> world: (-2, 10)
      // ( 3,  5) -> (-5,  3) -> world: (-2, 14)
      // minX = -2, maxX = 4 (width = 6)
      // minZ = 10, maxZ = 14 (depth = 4)
      const r3 = rotateAabbXZ(box, 3, pivot);
      expect(r3).toEqual({ minX: -2, maxX: 4, minZ: 10, maxZ: 14 });
      expect(r3.maxX - r3.minX).toBe(6);
      expect(r3.maxZ - r3.minZ).toBe(4);
    });

    it("translates an AABB correctly", () => {
      const box = { minX: 1, maxX: 3, minZ: 5, maxZ: 7 };
      const translated = translateAabbXZ(box, 2, -1);
      expect(translated).toEqual({ minX: 3, maxX: 5, minZ: 4, maxZ: 6 });
    });

    it("mountedFootprintAabb contains every mounted pin position", () => {
      const p = GRID_830.pitchMeters;
      const pins = [
        makePin("p1", 0, 0),
        makePin("p2", 0, p),
        makePin("p3", p, 0),
        makePin("p4", p, p),
      ];
      // Part AABB includes pins plus a 1 mm margin:
      const partAabb = {
        minX: -0.001,
        maxX: p + 0.001,
        minZ: -0.001,
        maxZ: p + 0.001,
      };
      const anchorPinXZ = { x: 0, z: 0 };
      const anchorHole: HoleCoord = { region: "MAIN", col: 20, row: 1 };

      for (let k = 0; k < 4; k++) {
        const footAabb = mountedFootprintAabb(
          GRID_830,
          anchorHole,
          partAabb,
          anchorPinXZ,
          k as QuarterTurns
        );
        expect(footAabb).not.toBeNull();
        if (!footAabb) continue;

        const res = mountedPinAddresses(GRID_830, "bb", pins, anchorHole, k as QuarterTurns);
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        for (const addr of Object.values(res.addresses)) {
          const parsed = parseHoleAddress(addr);
          expect(parsed).not.toBeNull();
          if (!parsed) continue;
          const pos = holeToLocal(GRID_830, parsed.hole);
          expect(pos).not.toBeNull();
          if (!pos) continue;

          // Check pos is inside footAabb
          const eps = 1e-6;
          expect(pos.x).toBeGreaterThanOrEqual(footAabb.minX - eps);
          expect(pos.x).toBeLessThanOrEqual(footAabb.maxX + eps);
          expect(pos.z).toBeGreaterThanOrEqual(footAabb.minZ - eps);
          expect(pos.z).toBeLessThanOrEqual(footAabb.maxZ + eps);
        }
      }
    });
  });

  // 9. fast-check property: for random anchors and k in 0..3, if ok, every address
  //    is in bounds, all are unique, and anchor pin resolves to anchor hole
  describe("fast-check property", () => {
    it("for random anchors and k in 0..3, if ok, every address is in bounds, all are unique, and anchor pin resolves to anchor hole", () => {
      const p = GRID_830.pitchMeters;
      // Fixed 4-pin part: 2x2 grid at pitch spacing
      const testPins = [
        makePin("p_tl", 0, 0),
        makePin("p_bl", 0, p),
        makePin("p_tr", p, 0),
        makePin("p_br", p, p),
      ];

      const holeArb = fc.record({
        region: fc.constant<BreadboardRegion>("MAIN"),
        col: fc.integer({ min: 0, max: GRID_830.cols - 1 }),
        row: fc.integer({ min: 0, max: 2 * GRID_830.rowsPerSide - 1 }),
      });

      const quarterTurnsArb = fc.integer({ min: 0, max: 3 });

      fc.assert(
        fc.property(holeArb, quarterTurnsArb, (anchorHole, k) => {
          const res = mountedPinAddresses(
            GRID_830,
            "bb_prop",
            testPins,
            anchorHole,
            k
          );
          if (res.ok) {
            // Anchor pin is p_tl (x=0, z=0)
            const expectedAnchorAddr = formatHoleAddress("bb_prop", anchorHole);
            expect(res.addresses["p_tl"]).toBe(expectedAnchorAddr);

            const addresses = Object.values(res.addresses);
            // All unique
            const unique = new Set(addresses);
            expect(unique.size).toBe(addresses.length);

            // Every address is in bounds
            for (const addr of addresses) {
              const parsed = parseHoleAddress(addr);
              expect(parsed).not.toBeNull();
              if (parsed) {
                expect(isHoleInBounds(GRID_830, parsed.hole)).toBe(true);
              }
            }
          }
        }),
        { seed: 42, numRuns: 300 }
      );
    });
  });
});
