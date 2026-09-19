import { describe, expect, it } from "vitest";

import {
  detectCornersFromMask,
  fitLine,
  intersectLines,
} from "@/lib/image/detect-paper-corners";

function makeLuminance(width: number, height: number) {
  return new Float32Array(width * height).fill(128);
}

function fillRect(
  mask: boolean[],
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      mask[y * width + x] = true;
    }
  }
}

describe("fitLine and intersectLines", () => {
  it("intersects horizontal and vertical lines", () => {
    const horizontal = fitLine([
      { x: 0, y: 10 },
      { x: 50, y: 10 },
      { x: 100, y: 10 },
    ]);
    const vertical = fitLine([
      { x: 40, y: 0 },
      { x: 40, y: 50 },
      { x: 40, y: 100 },
    ]);

    expect(horizontal).toEqual({ vertical: false, a: 0, b: 10 });
    expect(vertical).toEqual({ vertical: true, x: 40 });

    expect(intersectLines(horizontal!, vertical!)).toEqual({ x: 40, y: 10 });
  });
});

describe("detectCornersFromMask", () => {
  it("detects corners for a white sheet occupying most of the frame", () => {
    const width = 200;
    const height = 200;
    const mask = new Array<boolean>(width * height).fill(false);
    fillRect(mask, width, 18, 22, 182, 178);

    const corners = detectCornersFromMask(
      mask,
      width,
      height,
      makeLuminance(width, height),
    );

    expect(corners).not.toBeNull();
    expect(corners?.[0].x).toBeLessThan(40);
    expect(corners?.[0].y).toBeLessThan(40);
    expect(corners?.[1].x).toBeGreaterThan(160);
    expect(corners?.[1].y).toBeLessThan(40);
    expect(corners?.[2].x).toBeGreaterThan(160);
    expect(corners?.[2].y).toBeGreaterThan(160);
    expect(corners?.[3].x).toBeLessThan(40);
    expect(corners?.[3].y).toBeGreaterThan(160);
  });

  it("detects perspective-skewed paper", () => {
    const width = 240;
    const height = 240;
    const mask = new Array<boolean>(width * height).fill(false);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside =
          y > x * 0.2 + 20 &&
          y < height - 24 &&
          x > 24 &&
          x < width - (height - y) * 0.15 - 20;
        mask[y * width + x] = inside;
      }
    }

    const corners = detectCornersFromMask(
      mask,
      width,
      height,
      makeLuminance(width, height),
    );

    expect(corners).not.toBeNull();
    expect(corners?.[0].x).toBeLessThan(corners?.[1].x ?? 0);
    expect(corners?.[3].x).toBeLessThan(corners?.[2].x ?? 0);
    expect(corners?.[0].y).toBeLessThan(corners?.[3].y ?? 0);
    expect(corners?.[1].y).toBeLessThan(corners?.[2].y ?? 0);
  });
});
