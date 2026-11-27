import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { BreadboardRegion, GridSpec, HoleCoord } from "@/types/circuit";
import {
  areHolesInSameStrip,
  formatHoleAddress,
  isHoleInBounds,
  parseHoleAddress,
} from "@/utils/breadboardGrid";

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
});
