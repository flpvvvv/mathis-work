import { describe, expect, it } from "vitest";

import {
  convexHull,
  detectQuadFromEdges,
  gradientScale,
  quadFromPolygon,
  scoreQuad,
  simplifyPolygon,
  sobelMagnitude,
} from "@/lib/image/detect-paper-edges";
import type { Point } from "@/lib/image/perspective";

const FRAME_WIDTH = 200;
const FRAME_HEIGHT = 240;
/** Ground truth: a sheet photographed slightly askew. */
const PAPER: Point[] = [
  { x: 30, y: 25 },
  { x: 170, y: 45 },
  { x: 160, y: 215 },
  { x: 25, y: 190 },
];

function pointInQuad(quad: Point[], x: number, y: number) {
  let sign = 0;
  for (let i = 0; i < quad.length; i += 1) {
    const start = quad[i];
    const end = quad[(i + 1) % quad.length];
    const cross =
      (end.x - start.x) * (y - start.y) - (end.y - start.y) * (x - start.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) {
      sign = Math.sign(cross);
    } else if (Math.sign(cross) !== sign) {
      return false;
    }
  }
  return true;
}

/** A bright sheet on a dark desk, with the light falling off to the corner. */
function makePaperPhoto(): Float32Array {
  const lum = new Float32Array(FRAME_WIDTH * FRAME_HEIGHT);

  for (let y = 0; y < FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const falloff = 1 - (0.3 * x) / FRAME_WIDTH - (0.4 * y) / FRAME_HEIGHT;
      const bright = pointInQuad(PAPER, x, y) ? 235 : 60;
      lum[y * FRAME_WIDTH + x] = bright * falloff;
    }
  }

  return lum;
}

function ringOf(quad: Point[], perEdge: number): Point[] {
  const points: Point[] = [];
  for (let edge = 0; edge < 4; edge += 1) {
    const start = quad[edge];
    const end = quad[(edge + 1) % 4];
    for (let step = 0; step < perEdge; step += 1) {
      const t = step / perEdge;
      points.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }
  return points;
}

describe("gradientScale", () => {
  it("returns the requested percentile of the magnitudes", () => {
    const magnitude = new Float32Array(100);
    for (let value = 1; value <= 100; value += 1) {
      magnitude[value - 1] = value;
    }

    expect(gradientScale(magnitude, 0.9)).toBe(90);
    expect(gradientScale(magnitude, 1)).toBe(100);
  });

  it("returns zero for a flat frame", () => {
    expect(gradientScale(new Float32Array(64), 0.9)).toBe(0);
  });
});

describe("convexHull", () => {
  it("reduces a filled square to its four corners", () => {
    const points: Point[] = [];
    for (let y = 10; y <= 30; y += 1) {
      for (let x = 10; x <= 30; x += 1) {
        points.push({ x, y });
      }
    }

    const hull = convexHull(points);
    expect(hull).toHaveLength(4);
    expect(hull).toEqual(
      expect.arrayContaining([
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 30, y: 30 },
        { x: 10, y: 30 },
      ]),
    );
  });
});

function expectSameCorners(actual: Point[], expected: Point[]) {
  expect(actual).toHaveLength(expected.length);
  for (const corner of expected) {
    expect(
      actual.some(
        (point) => Math.hypot(point.x - corner.x, point.y - corner.y) < 1,
      ),
    ).toBe(true);
  }
}

describe("simplifyPolygon", () => {
  it("collapses a dense ring to its four corners", () => {
    expectSameCorners(simplifyPolygon(ringOf(PAPER, 40), 3), PAPER);
  });
});

describe("quadFromPolygon", () => {
  it("fits the outlined quad", () => {
    const quad = quadFromPolygon(ringOf(PAPER, 25));

    expect(quad).not.toBeNull();
    for (const [index, corner] of PAPER.entries()) {
      expect(quad?.[index].x).toBeCloseTo(corner.x, 0);
      expect(quad?.[index].y).toBeCloseTo(corner.y, 0);
    }
  });
});

describe("scoreQuad", () => {
  it("prefers the sheet over a quad floating in the dark background", () => {
    const lum = makePaperPhoto();
    const magnitude = sobelMagnitude(lum, FRAME_WIDTH, FRAME_HEIGHT);
    const edgeScale = gradientScale(magnitude, 0.995);

    const sheet = scoreQuad(
      PAPER,
      lum,
      magnitude,
      edgeScale,
      FRAME_WIDTH,
      FRAME_HEIGHT,
    );
    const background = scoreQuad(
      [
        { x: 150, y: 0 },
        { x: 199, y: 0 },
        { x: 199, y: 45 },
        { x: 150, y: 45 },
      ],
      lum,
      magnitude,
      edgeScale,
      FRAME_WIDTH,
      FRAME_HEIGHT,
    );

    expect(sheet).toBeGreaterThan(0.7);
    expect(sheet).toBeGreaterThan(background);
  });
});

describe("detectQuadFromEdges", () => {
  it("finds the sheet outline under uneven lighting", () => {
    const lum = makePaperPhoto();
    const magnitude = sobelMagnitude(lum, FRAME_WIDTH, FRAME_HEIGHT);

    const quad = detectQuadFromEdges(
      lum,
      magnitude,
      FRAME_WIDTH,
      FRAME_HEIGHT,
    );

    expect(quad).not.toBeNull();
    for (const [index, corner] of PAPER.entries()) {
      expect(quad?.[index].x).toBeCloseTo(corner.x, -1);
      expect(quad?.[index].y).toBeCloseTo(corner.y, -1);
    }
  });

  it("returns null for a frame without edges", () => {
    const lum = new Float32Array(FRAME_WIDTH * FRAME_HEIGHT).fill(128);
    const magnitude = sobelMagnitude(lum, FRAME_WIDTH, FRAME_HEIGHT);

    expect(
      detectQuadFromEdges(lum, magnitude, FRAME_WIDTH, FRAME_HEIGHT),
    ).toBeNull();
  });

  it("returns null for texture without a sheet", () => {
    const lum = new Float32Array(FRAME_WIDTH * FRAME_HEIGHT);
    for (let index = 0; index < lum.length; index += 1) {
      lum[index] = 100 + ((index * 37) % 60);
    }
    const magnitude = sobelMagnitude(lum, FRAME_WIDTH, FRAME_HEIGHT);

    expect(
      detectQuadFromEdges(lum, magnitude, FRAME_WIDTH, FRAME_HEIGHT),
    ).toBeNull();
  });
});
