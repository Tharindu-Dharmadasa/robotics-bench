import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  SCHEMA_VERSION,
  SAFE_ID_REGEX,
  MAX_COMPONENTS,
  MAX_WIRES,
  MAX_COMPRESSED_CHARS,
  MAX_JSON_CHARS,
  DESK_POSITION_LIMIT_M,
  placedComponentSchema,
  jumperWireSchema,
  saveFileSchema,
  type SaveFile,
} from "./persistence";
import type { PlacedComponent, JumperWire } from "./circuit";

function makeDeskComponent(overrides?: Record<string, unknown>) {
  return {
    instanceId: "uno_1",
    defId: "arduino_uno",
    calibratedModelVersion: 1,
    placement: {
      kind: "DESK" as const,
      position: [0, 0.01, 0] as [number, number, number],
      yawRad: 0,
    },
    ...overrides,
  };
}

function makeBreadboardComponent(overrides?: Record<string, unknown>) {
  return {
    instanceId: "led_1",
    defId: "led_red",
    calibratedModelVersion: 1.5,
    placement: {
      kind: "BREADBOARD" as const,
      boardId: "bb_1",
      anchorHole: {
        region: "MAIN" as const,
        col: 10,
        row: 2,
      },
      quarterTurns: 0 as const,
    },
    ...overrides,
  };
}

function makeWire(overrides?: Record<string, unknown>) {
  return {
    id: "wire_1",
    from: { kind: "PIN" as const, instanceId: "uno_1", pinId: "D13" },
    to: {
      kind: "HOLE" as const,
      boardId: "bb_1",
      hole: { region: "MAIN" as const, col: 10, row: 2 },
    },
    color: "#FF00aa",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// (a) Constants have exact values
// ---------------------------------------------------------------------------
describe("(a) persistence constants", () => {
  it("have exact values from spec", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(MAX_COMPONENTS).toBe(64);
    expect(MAX_WIRES).toBe(256);
    expect(MAX_COMPRESSED_CHARS).toBe(16000);
    expect(MAX_JSON_CHARS).toBe(96000);
    expect(DESK_POSITION_LIMIT_M).toBe(5);
    expect(SAFE_ID_REGEX.test("uno_a1-B2")).toBe(true);
    expect(SAFE_ID_REGEX.test("uno:D13")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (b) Valid minimal and populated saves
// ---------------------------------------------------------------------------
describe("(b) valid saves", () => {
  it("accepts a minimal save with empty arrays", () => {
    const res = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [],
      wires: [],
    });
    expect(res.success).toBe(true);
  });

  it("accepts a save with one DESK component, one BREADBOARD component, and one wire (PIN to HOLE)", () => {
    const payload: SaveFile = {
      schemaVersion: 1,
      components: [makeDeskComponent(), makeBreadboardComponent()],
      wires: [makeWire()],
    };
    const res = saveFileSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (c) Unknown keys rejected at every level + forbidden state keys
// ---------------------------------------------------------------------------
describe("(c) strict unknown-key rejection", () => {
  it("rejects all forbidden runtime/fault keys at top level", () => {
    const forbiddenKeys = [
      "burntInstanceIds",
      "latchedOverloadIds",
      "damagedPinAddresses",
      "powerEnabled",
      "inputStates",
      "manualPins",
      "extraTopKey",
    ];
    for (const key of forbiddenKeys) {
      const res = saveFileSchema.safeParse({
        schemaVersion: 1,
        components: [],
        wires: [],
        [key]: [],
      });
      expect(res.success).toBe(false);
    }
  });

  it("rejects unknown keys in a component", () => {
    const res = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [makeDeskComponent({ extraProp: 123 })],
      wires: [],
    });
    expect(res.success).toBe(false);
  });

  it("rejects unknown keys in DESK and BREADBOARD placements", () => {
    const deskRes = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [
        makeDeskComponent({
          placement: {
            kind: "DESK",
            position: [0, 0, 0],
            yawRad: 0,
            extraPlacement: true,
          },
        }),
      ],
      wires: [],
    });
    expect(deskRes.success).toBe(false);

    const bbRes = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [
        makeBreadboardComponent({
          placement: {
            kind: "BREADBOARD",
            boardId: "bb_1",
            anchorHole: { region: "MAIN", col: 0, row: 0 },
            quarterTurns: 1,
            extraPlacement: true,
          },
        }),
      ],
      wires: [],
    });
    expect(bbRes.success).toBe(false);
  });

  it("rejects unknown keys in a hole (in placement and in wire)", () => {
    const compHoleRes = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [
        makeBreadboardComponent({
          placement: {
            kind: "BREADBOARD",
            boardId: "bb_1",
            anchorHole: { region: "MAIN", col: 0, row: 0, extraHole: 1 },
            quarterTurns: 0,
          },
        }),
      ],
      wires: [],
    });
    expect(compHoleRes.success).toBe(false);

    const wireHoleRes = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [],
      wires: [
        makeWire({
          to: {
            kind: "HOLE",
            boardId: "bb_1",
            hole: { region: "MAIN", col: 1, row: 1, extraHole: 1 },
          },
        }),
      ],
    });
    expect(wireHoleRes.success).toBe(false);
  });

  it("rejects unknown keys in a wire and in PIN/HOLE pinRefs (including PIN with extra boardId)", () => {
    const wireExtra = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [],
      wires: [makeWire({ extraWire: "nope" })],
    });
    expect(wireExtra.success).toBe(false);

    const pinWithBoardId = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [],
      wires: [
        makeWire({
          from: {
            kind: "PIN",
            instanceId: "uno_1",
            pinId: "D13",
            boardId: "bb_1",
          },
        }),
      ],
    });
    expect(pinWithBoardId.success).toBe(false);

    const holeWithPinId = saveFileSchema.safeParse({
      schemaVersion: 1,
      components: [],
      wires: [
        makeWire({
          to: {
            kind: "HOLE",
            boardId: "bb_1",
            hole: { region: "MAIN", col: 0, row: 0 },
            pinId: "D13",
          },
        }),
      ],
    });
    expect(holeWithPinId.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (d) NaN, Infinity, -Infinity rejected
// ---------------------------------------------------------------------------
describe("(d) non-finite numbers rejected", () => {
  it.each([NaN, Infinity, -Infinity])(
    "rejects %s in desk position, yawRad, and calibratedModelVersion",
    (badNum) => {
      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [
            makeDeskComponent({
              placement: {
                kind: "DESK",
                position: [badNum, 0, 0],
                yawRad: 0,
              },
            }),
          ],
          wires: [],
        }).success,
      ).toBe(false);

      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [
            makeDeskComponent({
              placement: {
                kind: "DESK",
                position: [0, 0, 0],
                yawRad: badNum,
              },
            }),
          ],
          wires: [],
        }).success,
      ).toBe(false);

      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [makeDeskComponent({ calibratedModelVersion: badNum })],
          wires: [],
        }).success,
      ).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// (e) SafeId validation (':' and empty string rejected)
// ---------------------------------------------------------------------------
describe("(e) SafeId validation", () => {
  it("rejects ':' in instanceId, defId, boardId, wire id, and pinId, and rejects empty strings", () => {
    for (const badId of ["a:b", ""]) {
      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [makeDeskComponent({ instanceId: badId })],
          wires: [],
        }).success,
      ).toBe(false);

      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [makeDeskComponent({ defId: badId })],
          wires: [],
        }).success,
      ).toBe(false);

      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [
            makeBreadboardComponent({
              placement: {
                kind: "BREADBOARD",
                boardId: badId,
                anchorHole: { region: "MAIN", col: 0, row: 0 },
                quarterTurns: 0,
              },
            }),
          ],
          wires: [],
        }).success,
      ).toBe(false);

      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [],
          wires: [makeWire({ id: badId })],
        }).success,
      ).toBe(false);

      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [],
          wires: [
            makeWire({
              from: { kind: "PIN", instanceId: "uno_1", pinId: badId },
            }),
          ],
        }).success,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// (f) Max array caps (64 components, 256 wires)
// ---------------------------------------------------------------------------
describe("(f) array size caps", () => {
  it("accepts 64 components and 256 wires, rejects 65 components and 257 wires", () => {
    const comps64 = Array.from({ length: 64 }, (_, i) =>
      makeDeskComponent({ instanceId: `c_${i}` }),
    );
    const wires256 = Array.from({ length: 256 }, (_, i) =>
      makeWire({ id: `w_${i}` }),
    );
    expect(
      saveFileSchema.safeParse({
        schemaVersion: 1,
        components: comps64,
        wires: wires256,
      }).success,
    ).toBe(true);

    const comps65 = Array.from({ length: 65 }, (_, i) =>
      makeDeskComponent({ instanceId: `c_${i}` }),
    );
    expect(
      saveFileSchema.safeParse({
        schemaVersion: 1,
        components: comps65,
        wires: [],
      }).success,
    ).toBe(false);

    const wires257 = Array.from({ length: 257 }, (_, i) =>
      makeWire({ id: `w_${i}` }),
    );
    expect(
      saveFileSchema.safeParse({
        schemaVersion: 1,
        components: [],
        wires: wires257,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (g) Wire hex color validation
// ---------------------------------------------------------------------------
describe("(g) wire color validation", () => {
  it("rejects invalid colors and accepts #FF00aa", () => {
    for (const bad of ["red", "#fff", "#GGGGGG", "ff0000"]) {
      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [],
          wires: [makeWire({ color: bad })],
        }).success,
      ).toBe(false);
    }
    expect(
      saveFileSchema.safeParse({
        schemaVersion: 1,
        components: [],
        wires: [makeWire({ color: "#FF00aa" })],
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (h) Desk position bounds (±5 m)
// ---------------------------------------------------------------------------
describe("(h) desk position bounds", () => {
  it("accepts 5 and -5, rejects 5.001 and -5.001", () => {
    for (const ok of [5, -5]) {
      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [
            makeDeskComponent({
              placement: {
                kind: "DESK",
                position: [ok, ok, ok],
                yawRad: 0,
              },
            }),
          ],
          wires: [],
        }).success,
      ).toBe(true);
    }
    for (const bad of [5.001, -5.001]) {
      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [
            makeDeskComponent({
              placement: {
                kind: "DESK",
                position: [bad, 0, 0],
                yawRad: 0,
              },
            }),
          ],
          wires: [],
        }).success,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// (i) quarterTurns, region, col/row, schemaVersion
// ---------------------------------------------------------------------------
describe("(i) placement & schemaVersion constraints", () => {
  it("rejects quarterTurns 4 and 1.5, region MIDDLE, negative/non-int col/row, missing schemaVersion", () => {
    for (const badTurns of [4, 1.5]) {
      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [
            makeBreadboardComponent({
              placement: {
                kind: "BREADBOARD",
                boardId: "bb_1",
                anchorHole: { region: "MAIN", col: 0, row: 0 },
                quarterTurns: badTurns,
              },
            }),
          ],
          wires: [],
        }).success,
      ).toBe(false);
    }

    expect(
      saveFileSchema.safeParse({
        schemaVersion: 1,
        components: [
          makeBreadboardComponent({
            placement: {
              kind: "BREADBOARD",
              boardId: "bb_1",
              anchorHole: { region: "MIDDLE", col: 0, row: 0 },
              quarterTurns: 0,
            },
          }),
        ],
        wires: [],
      }).success,
    ).toBe(false);

    for (const badCoord of [
      { region: "MAIN", col: -1, row: 0 },
      { region: "MAIN", col: 0, row: -1 },
      { region: "MAIN", col: 1.5, row: 0 },
      { region: "MAIN", col: 0, row: 1.5 },
    ]) {
      expect(
        saveFileSchema.safeParse({
          schemaVersion: 1,
          components: [
            makeBreadboardComponent({
              placement: {
                kind: "BREADBOARD",
                boardId: "bb_1",
                anchorHole: badCoord,
                quarterTurns: 0,
              },
            }),
          ],
          wires: [],
        }).success,
      ).toBe(false);
    }

    expect(
      saveFileSchema.safeParse({
        components: [],
        wires: [],
      }).success,
    ).toBe(false);

    expect(
      saveFileSchema.safeParse({
        schemaVersion: 1.5,
        components: [],
        wires: [],
      }).success,
    ).toBe(false);

    expect(
      saveFileSchema.safeParse({
        schemaVersion: 2,
        components: [],
        wires: [],
      }).success,
    ).toBe(true);
  });

  it("accepts large col/row values (e.g. 9999) since upper bounds belong to 3.1b", () => {
    expect(
      saveFileSchema.safeParse({
        schemaVersion: 1,
        components: [
          makeBreadboardComponent({
            placement: {
              kind: "BREADBOARD",
              boardId: "bb_1",
              anchorHole: { region: "MAIN", col: 9999, row: 9999 },
              quarterTurns: 2,
            },
          }),
        ],
        wires: [],
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (j) Compile-time schema/type drift check
// ---------------------------------------------------------------------------
describe("(j) compile-time type parity with circuit.ts", () => {
  it("inferred placedComponentSchema and jumperWireSchema types equal PlacedComponent and JumperWire", () => {
    type InferredPlacedComponent = z.infer<typeof placedComponentSchema>;
    type InferredJumperWire = z.infer<typeof jumperWireSchema>;

    expectTypeOf<InferredPlacedComponent>().toEqualTypeOf<PlacedComponent>();
    expectTypeOf<InferredJumperWire>().toEqualTypeOf<JumperWire>();
  });
});
