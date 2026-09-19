import { describe, expect, it } from "vitest";

import {
  applyWhiteBalanceToPixels,
  gainsFromSample,
  linearToSrgb,
  srgbToLinear,
} from "@/lib/image/white-balance";

const WARM_PAPER = { r: 230, g: 214, b: 188 };

function applyToSample(sample: { r: number; g: number; b: number }, gains: { r: number; g: number; b: number }) {
  return {
    r: srgbToLinear(sample.r) * gains.r,
    g: srgbToLinear(sample.g) * gains.g,
    b: srgbToLinear(sample.b) * gains.b,
  };
}

describe("gainsFromSample", () => {
  it("neutralises the sampled colour", () => {
    const gains = gainsFromSample(WARM_PAPER);
    const corrected = applyToSample(WARM_PAPER, gains);

    expect(corrected.g).toBeCloseTo(corrected.r, 6);
    expect(corrected.b).toBeCloseTo(corrected.r, 6);
  });

  it("keeps the exposure of the sample", () => {
    const gains = gainsFromSample(WARM_PAPER);
    const corrected = applyToSample(WARM_PAPER, gains);
    const luma =
      0.2126 * srgbToLinear(WARM_PAPER.r) +
      0.7152 * srgbToLinear(WARM_PAPER.g) +
      0.0722 * srgbToLinear(WARM_PAPER.b);

    expect(corrected.r).toBeCloseTo(luma, 6);
  });

  it("leaves an already neutral sample alone", () => {
    const gains = gainsFromSample({ r: 200, g: 200, b: 200 });

    expect(gains.r).toBeCloseTo(1, 6);
    expect(gains.g).toBeCloseTo(1, 6);
    expect(gains.b).toBeCloseTo(1, 6);
  });

  it("fades back to no correction as strength drops", () => {
    const full = gainsFromSample(WARM_PAPER);
    const half = gainsFromSample(WARM_PAPER, { strength: 0.5 });
    const none = gainsFromSample(WARM_PAPER, { strength: 0 });

    expect(half.r).toBeCloseTo(1 + (full.r - 1) / 2, 6);
    expect(none).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("scales the corrected luminance with brightness", () => {
    const gains = gainsFromSample(WARM_PAPER, { brightness: 2 });
    const corrected = applyToSample(WARM_PAPER, gains);
    const neutral = applyToSample(WARM_PAPER, gainsFromSample(WARM_PAPER));

    expect(corrected.r).toBeCloseTo(neutral.r * 2, 6);
  });

  it("does not explode on a near-black sample", () => {
    const gains = gainsFromSample({ r: 6, g: 6, b: 6 });

    expect(Number.isFinite(gains.r)).toBe(true);
    expect(gains.r).toBeLessThanOrEqual(5);
  });
});

describe("applyWhiteBalanceToPixels", () => {
  it("neutralises a warm pixel in place", () => {
    const data = new Uint8ClampedArray([230, 214, 188, 255]);

    applyWhiteBalanceToPixels(data, gainsFromSample(WARM_PAPER));

    expect(Math.abs(data[0] - data[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(data[1] - data[2])).toBeLessThanOrEqual(1);
    expect(data[3]).toBe(255);
  });

  it("leaves pixels untouched when there is nothing to correct", () => {
    const data = new Uint8ClampedArray([12, 200, 90, 128]);

    applyWhiteBalanceToPixels(data, { r: 1, g: 1, b: 1 });

    expect([...data]).toEqual([12, 200, 90, 128]);
  });

  it("rolls highlighted whites off instead of clipping them flat", () => {
    const data = new Uint8ClampedArray([250, 250, 250, 255]);

    applyWhiteBalanceToPixels(data, { r: 1.1, g: 1.1, b: 1.1 });

    expect(data[0]).toBeGreaterThan(250);
    expect(data[0]).toBeLessThan(255);
  });
});

describe("colour space round trip", () => {
  it("survives sRGB → linear → sRGB", () => {
    for (const value of [0, 1, 32, 128, 200, 255]) {
      expect(linearToSrgb(srgbToLinear(value))).toBe(value);
    }
  });
});
