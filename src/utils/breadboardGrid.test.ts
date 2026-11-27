// ---------------------------------------------------------------------------
// src/utils/breadboardGrid.test.ts -- Tests for breadboardGrid.ts (1.2c-i and 1.2c-ii)
// Plain ASCII only in all comments and strings.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { BreadboardRegion, GridSpec, HoleCoord } from "@/types/circuit";
import {
  areHolesInSameStrip,
  CENTER_GAP_EXTRA_PITCHES,
  formatHoleAddress,
  HIT_RADIUS_PITCHES,
  holeToLocal,
  isHoleInBounds,
  nearestHoleLocal,
  parseHoleAddress,
  RAIL_OFFSET_PITCHES,
  RAIL_SEGMENT_GAP_EXTRA_PITCHES,
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
