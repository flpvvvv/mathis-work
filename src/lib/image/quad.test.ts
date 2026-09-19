import { describe, expect, it } from "vitest";

import { isValidPaperQuad, orderCorners } from "@/lib/image/quad";

describe("orderCorners", () => {
  it("orders points as TL, TR, BR, BL", () => {
    const ordered = orderCorners([
      { x: 180, y: 220 },
      { x: 20, y: 200 },
      { x: 30, y: 40 },
      { x: 170, y: 30 },
    ]);

    expect(ordered).toEqual([
      { x: 30, y: 40 },
      { x: 170, y: 30 },
      { x: 180, y: 220 },
      { x: 20, y: 200 },
    ]);
  });
});

describe("isValidPaperQuad", () => {
  it("accepts a large convex rectangle", () => {
    expect(
      isValidPaperQuad(
        [
          { x: 20, y: 20 },
          { x: 180, y: 25 },
          { x: 175, y: 175 },
          { x: 25, y: 180 },
        ],
        200,
        200,
      ),
    ).toBe(true);
  });

  it("rejects tiny detections", () => {
    expect(
      isValidPaperQuad(
        [
          { x: 90, y: 90 },
          { x: 110, y: 90 },
          { x: 110, y: 110 },
          { x: 90, y: 110 },
        ],
        200,
        200,
      ),
    ).toBe(false);
  });

  it("rejects a quad covering the whole frame", () => {
    expect(
      isValidPaperQuad(
        [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 200 },
          { x: 0, y: 200 },
        ],
        200,
        200,
      ),
    ).toBe(false);
  });
});
