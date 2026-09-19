import { describe, expect, it } from "vitest";

import {
  normalizeRotation,
  rotatePoint,
  rotatePoints,
  rotatedSize,
} from "@/lib/image/rotate";

describe("normalizeRotation", () => {
  it("wraps an angle into one of the four quarter turns", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(720)).toBe(0);
  });
});

describe("rotatedSize", () => {
  it("swaps the sides for quarter turns only", () => {
    expect(rotatedSize(400, 300, 0)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, 180)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 270)).toEqual({ width: 300, height: 400 });
  });
});

describe("rotatePoint", () => {
  it("sends the top-left corner around the frame", () => {
    expect(rotatePoint({ x: 0, y: 0 }, 90, 400, 300)).toEqual({
      x: 300,
      y: 0,
    });
    expect(rotatePoint({ x: 0, y: 0 }, 180, 400, 300)).toEqual({
      x: 400,
      y: 300,
    });
    expect(rotatePoint({ x: 0, y: 0 }, 270, 400, 300)).toEqual({
      x: 0,
      y: 400,
    });
  });

  it("returns to the start after four turns", () => {
    const point = { x: 120, y: 40 };
    const first = rotatePoint(point, 90, 400, 300);
    const second = rotatePoint(first, 90, 300, 400);
    const third = rotatePoint(second, 90, 400, 300);

    expect(third).toEqual({ x: 40, y: 280 });
    expect(rotatePoint(third, 90, 300, 400)).toEqual(point);
  });
});

describe("rotatePoints", () => {
  it("matches a single turn for each rotation", () => {
    const point = { x: 90, y: 30 };

    expect(rotatePoints([point], 90, 400, 300)).toEqual([
      rotatePoint(point, 90, 400, 300),
    ]);
    expect(rotatePoints([point], 180, 400, 300)).toEqual([
      rotatePoint(point, 180, 400, 300),
    ]);
    expect(rotatePoints([point], 270, 400, 300)).toEqual([
      rotatePoint(point, 270, 400, 300),
    ]);
  });

  it("leaves points untouched for a full turn", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];

    expect(rotatePoints(points, 0, 400, 300)).toEqual(points);
  });
});
