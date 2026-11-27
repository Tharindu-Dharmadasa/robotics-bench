import { describe, expect, it } from "vitest";

describe("sandbox test runner", () => {
  it("runs Vitest in node environment", () => {
    expect(1 + 1).toBe(2);
  });
});
