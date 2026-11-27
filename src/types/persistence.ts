// ---------------------------------------------------------------------------
// src/types/persistence.ts — Save-file constants & strict Zod schemas
//
// See ARCHITECTURE.md §5.6.10 and RULES.md rules 6, 7.
// ---------------------------------------------------------------------------

import { z } from "zod";

export const SCHEMA_VERSION = 1;
export const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export const MAX_COMPONENTS = 64;
export const MAX_WIRES = 256;
export const MAX_COMPRESSED_CHARS = 16000;
export const MAX_JSON_CHARS = 96000;
export const DESK_POSITION_LIMIT_M = 5;

export const safeIdSchema = z.string().regex(SAFE_ID_REGEX);

export const holeCoordSchema = z
  .object({
    region: z.enum(["MAIN", "TOP_POS", "TOP_NEG", "BOT_POS", "BOT_NEG"]),
    col: z.number().int().nonnegative(),
    row: z.number().int().nonnegative(),
  })
  .strict();

export const pinRefSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("PIN"),
      instanceId: safeIdSchema,
      pinId: safeIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("HOLE"),
      boardId: safeIdSchema,
      hole: holeCoordSchema,
    })
    .strict(),
]);

const deskCoordSchema = z
  .number()
  .min(-DESK_POSITION_LIMIT_M)
  .max(DESK_POSITION_LIMIT_M);

export const placementSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("DESK"),
      position: z.tuple([deskCoordSchema, deskCoordSchema, deskCoordSchema]),
      yawRad: z.number(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("BREADBOARD"),
      boardId: safeIdSchema,
      anchorHole: holeCoordSchema,
      quarterTurns: z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
      ]),
    })
    .strict(),
]);

export const placedComponentSchema = z
  .object({
    instanceId: safeIdSchema,
    defId: safeIdSchema,
    calibratedModelVersion: z.number(),
    placement: placementSchema,
  })
  .strict();

export const jumperWireSchema = z
  .object({
    id: safeIdSchema,
    from: pinRefSchema,
    to: pinRefSchema,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();

export const saveFileSchema = z
  .object({
    schemaVersion: z.number().int(),
    components: z.array(placedComponentSchema).max(MAX_COMPONENTS),
    wires: z.array(jumperWireSchema).max(MAX_WIRES),
  })
  .strict();

export type SaveFile = z.infer<typeof saveFileSchema>;
