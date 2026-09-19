export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type WhiteBalanceGains = Rgb;

/** Rec. 709 weights, matching the sRGB primaries. */
const LUMA_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 };
/** Floor for a sampled channel, so a near-black sample cannot explode the gains. */
const MIN_CHANNEL_LINEAR = 0.008;
const MIN_GAIN = 0.2;
const MAX_GAIN = 5;
/** Linear level above which highlights are rolled off instead of clipped. */
const HIGHLIGHT_KNEE = 0.88;
const LINEAR_TABLE_SIZE = 8192;

const SRGB_TO_LINEAR = (() => {
  const table = new Float32Array(256);
  for (let value = 0; value < 256; value += 1) {
    const channel = value / 255;
    table[value] =
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
  }
  return table;
})();

const LINEAR_TO_SRGB = (() => {
  const table = new Uint8ClampedArray(LINEAR_TABLE_SIZE + 1);
  for (let index = 0; index <= LINEAR_TABLE_SIZE; index += 1) {
    const linear = index / LINEAR_TABLE_SIZE;
    const channel =
      linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
    table[index] = Math.round(channel * 255);
  }
  return table;
})();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function srgbToLinear(value: number): number {
  return SRGB_TO_LINEAR[clamp(Math.round(value), 0, 255)];
}

export function linearToSrgb(value: number): number {
  return LINEAR_TO_SRGB[clamp(Math.round(value * LINEAR_TABLE_SIZE), 0, LINEAR_TABLE_SIZE)];
}

/** Rolls values above the knee towards white instead of flattening them. */
function rollOffHighlights(linear: number): number {
  if (linear <= HIGHLIGHT_KNEE) return linear;
  const range = 1 - HIGHLIGHT_KNEE;
  return HIGHLIGHT_KNEE + range * (1 - Math.exp(-(linear - HIGHLIGHT_KNEE) / range));
}

/**
 * Per-channel multipliers (linear light) that turn the sampled colour into a
 * neutral one. The correction is luminance preserving, so the paper keeps its
 * exposure and only the colour cast is removed; `brightness` then scales the
 * result, and `strength` fades the whole correction back towards "off".
 */
export function gainsFromSample(
  sample: Rgb,
  options: { strength?: number; brightness?: number } = {},
): WhiteBalanceGains {
  const { strength = 1, brightness = 1 } = options;
  const red = Math.max(srgbToLinear(sample.r), MIN_CHANNEL_LINEAR);
  const green = Math.max(srgbToLinear(sample.g), MIN_CHANNEL_LINEAR);
  const blue = Math.max(srgbToLinear(sample.b), MIN_CHANNEL_LINEAR);

  const luma =
    LUMA_WEIGHTS.r * red + LUMA_WEIGHTS.g * green + LUMA_WEIGHTS.b * blue;
  const target = luma * brightness;

  return {
    r: clamp(1 + (target / red - 1) * strength, MIN_GAIN, MAX_GAIN),
    g: clamp(1 + (target / green - 1) * strength, MIN_GAIN, MAX_GAIN),
    b: clamp(1 + (target / blue - 1) * strength, MIN_GAIN, MAX_GAIN),
  };
}

export function isIdentityGains(gains: WhiteBalanceGains): boolean {
  return (
    Math.abs(gains.r - 1) < 1e-3 &&
    Math.abs(gains.g - 1) < 1e-3 &&
    Math.abs(gains.b - 1) < 1e-3
  );
}

/**
 * Applies the gains to an RGBA buffer in place, in linear light. Alpha is left
 * untouched.
 */
export function applyWhiteBalanceToPixels(
  data: Uint8ClampedArray,
  gains: WhiteBalanceGains,
): void {
  if (isIdentityGains(gains)) return;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = linearToSrgb(
      rollOffHighlights(SRGB_TO_LINEAR[data[index]] * gains.r),
    );
    data[index + 1] = linearToSrgb(
      rollOffHighlights(SRGB_TO_LINEAR[data[index + 1]] * gains.g),
    );
    data[index + 2] = linearToSrgb(
      rollOffHighlights(SRGB_TO_LINEAR[data[index + 2]] * gains.b),
    );
  }
}

export function applyWhiteBalance(
  canvas: HTMLCanvasElement,
  gains: WhiteBalanceGains,
): void {
  if (isIdentityGains(gains)) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyWhiteBalanceToPixels(imageData.data, gains);
  context.putImageData(imageData, 0, 0);
}

/**
 * Median colour of the square patch around (x, y). Median rather than mean so a
 * pencil stroke or a spec on the paper does not skew the sample.
 */
export function sampleWhiteRegion(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
): Rgb | null {
  const context = canvas.getContext("2d");
  if (!context) return null;

  const size = Math.max(2, Math.round(radius * 2));
  const left = clamp(Math.round(x - size / 2), 0, Math.max(0, canvas.width - 1));
  const top = clamp(Math.round(y - size / 2), 0, Math.max(0, canvas.height - 1));
  const width = Math.min(size, canvas.width - left);
  const height = Math.min(size, canvas.height - top);
  if (width < 2 || height < 2) return null;

  const { data } = context.getImageData(left, top, width, height);
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];

  for (let index = 0; index < data.length; index += 4) {
    reds.push(data[index]);
    greens.push(data[index + 1]);
    blues.push(data[index + 2]);
  }

  return { r: median(reds), g: median(greens), b: median(blues) };
}
