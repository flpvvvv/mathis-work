import type { Point } from "@/lib/image/perspective";

const MAX_ANALYSIS_DIM = 900;
const CORNER_PATCH_RATIO = 0.1;
const CENTER_PATCH_RATIO = 0.35;

type Line =
  | { vertical: true; x: number }
  | { vertical: false; a: number; b: number };

type AnalysisImage = {
  width: number;
  height: number;
  scale: number;
  luminance: Float32Array;
  rgba: Uint8ClampedArray;
};

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function medianRgb(samples: number[][]) {
  return [
    median(samples.map((sample) => sample[0])),
    median(samples.map((sample) => sample[1])),
    median(samples.map((sample) => sample[2])),
  ] as const;
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  target: readonly [number, number, number],
) {
  return Math.hypot(r - target[0], g - target[1], b - target[2]);
}

function createAnalysisImage(image: HTMLImageElement): AnalysisImage | null {
  const maxDim = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = maxDim > MAX_ANALYSIS_DIM ? MAX_ANALYSIS_DIM / maxDim : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const rgba = imageData.data;
  const lum = new Float32Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    lum[i] = luminance(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
  }

  return { width, height, scale, luminance: lum, rgba };
}

function samplePatch(
  rgba: Uint8ClampedArray,
  lum: Float32Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  patchRatio: number,
) {
  const patchW = Math.max(4, Math.round(width * patchRatio));
  const patchH = Math.max(4, Math.round(height * patchRatio));
  const startX = clamp(
    Math.round(centerX - patchW / 2),
    0,
    Math.max(0, width - patchW),
  );
  const startY = clamp(
    Math.round(centerY - patchH / 2),
    0,
    Math.max(0, height - patchH),
  );

  const rgbSamples: number[][] = [];
  const lumSamples: number[] = [];

  for (let y = startY; y < startY + patchH; y += 1) {
    for (let x = startX; x < startX + patchW; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      rgbSamples.push([rgba[offset], rgba[offset + 1], rgba[offset + 2]]);
      lumSamples.push(lum[index]);
    }
  }

  return { rgb: medianRgb(rgbSamples), lum: median(lumSamples) };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildPaperMask(
  analysis: AnalysisImage,
  paperRgb: readonly [number, number, number],
  paperLum: number,
  bgLum: number,
) {
  const { width, height, luminance: lum, rgba } = analysis;
  const contrast = paperLum - bgLum;
  const lumThreshold = bgLum + contrast * 0.42;
  const colorThreshold = contrast < 35 ? 95 : 72;
  const mask = new Array<boolean>(width * height).fill(false);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const isBrightEnough = lum[index] >= lumThreshold;
      const isPaperColored =
        colorDistance(rgba[offset], rgba[offset + 1], rgba[offset + 2], paperRgb) <=
        colorThreshold;
      mask[index] = isBrightEnough && isPaperColored;
    }
  }

  return mask;
}

function dilateMask(mask: boolean[], width: number, height: number) {
  const next = [...mask];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (mask[index]) continue;
      if (
        mask[index - 1] ||
        mask[index + 1] ||
        mask[index - width] ||
        mask[index + width]
      ) {
        next[index] = true;
      }
    }
  }
  return next;
}

function erodeMask(mask: boolean[], width: number, height: number) {
  const next = [...mask];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      if (
        !mask[index - 1] ||
        !mask[index + 1] ||
        !mask[index - width] ||
        !mask[index + width]
      ) {
        next[index] = false;
      }
    }
  }
  return next;
}

function keepLargestComponent(mask: boolean[], width: number, height: number) {
  const visited = new Uint8Array(width * height);
  const next = new Array<boolean>(width * height).fill(false);
  let best: number[] = [];

  for (let start = 0; start < width * height; start += 1) {
    if (!mask[start] || visited[start]) continue;

    const component: number[] = [];
    const stack = [start];
    visited[start] = 1;

    while (stack.length > 0) {
      const index = stack.pop();
      if (index === undefined) break;
      component.push(index);

      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (neighbor < 0 || visited[neighbor] || !mask[neighbor]) continue;
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    if (component.length > best.length) {
      best = component;
    }
  }

  for (const index of best) {
    next[index] = true;
  }

  return next;
}

function collectBoundaryPoints(mask: boolean[], width: number, height: number) {
  const points: Point[] = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      const isBoundary =
        !mask[index - 1] ||
        !mask[index + 1] ||
        !mask[index - width] ||
        !mask[index + width];
      if (isBoundary) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

export function fitLine(points: Point[]): Line | null {
  if (points.length < 3) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const count = points.length;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const denominator = count * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-4) {
    return { vertical: true, x: sumX / count };
  }

  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  return { vertical: false, a: slope, b: intercept };
}

export function intersectLines(first: Line, second: Line): Point | null {
  if (first.vertical && second.vertical) return null;

  if (first.vertical && !second.vertical) {
    const x = first.x;
    return { x, y: second.a * x + second.b };
  }

  if (!first.vertical && second.vertical) {
    const x = second.x;
    return { x, y: first.a * x + first.b };
  }

  if (!first.vertical && !second.vertical) {
    if (Math.abs(first.a - second.a) < 1e-4) return null;
    const x = (second.b - first.b) / (first.a - second.a);
    return { x, y: first.a * x + first.b };
  }

  return null;
}

function classifyEdgePoints(
  boundary: Point[],
  centroid: Point,
): { top: Point[]; right: Point[]; bottom: Point[]; left: Point[] } {
  const groups = {
    top: [] as Point[],
    right: [] as Point[],
    bottom: [] as Point[],
    left: [] as Point[],
  };

  for (const point of boundary) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    if (angle >= -135 && angle < -45) {
      groups.top.push(point);
    } else if (angle >= -45 && angle < 45) {
      groups.right.push(point);
    } else if (angle >= 45 && angle < 135) {
      groups.bottom.push(point);
    } else {
      groups.left.push(point);
    }
  }

  return groups;
}

function gradientMagnitude(
  lum: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const left = lum[y * width + (x - 1)];
  const right = lum[y * width + (x + 1)];
  const up = lum[(y - 1) * width + x];
  const down = lum[(y + 1) * width + x];
  return Math.hypot(right - left, down - up);
}

function refineCorner(
  lum: Float32Array,
  mask: boolean[],
  width: number,
  height: number,
  corner: Point,
) {
  const radius = Math.max(3, Math.round(Math.min(width, height) * 0.035));
  let best = corner;
  let bestScore = -1;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = Math.round(corner.x + dx);
      const y = Math.round(corner.y + dy);
      if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) continue;

      const index = y * width + x;
      const onBoundary =
        mask[index] &&
        (!mask[index - 1] ||
          !mask[index + 1] ||
          !mask[index - width] ||
          !mask[index + width]);
      if (!onBoundary) continue;

      const score = gradientMagnitude(lum, width, height, x, y);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }

  return best;
}

export function orderCorners(points: Point[]): Point[] {
  const sortedByY = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const top = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

function polygonArea(points: Point[]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function isValidPaperQuad(points: Point[], width: number, height: number) {
  if (points.length !== 4) return false;

  const ordered = orderCorners(points);
  const imageArea = width * height;
  const area = polygonArea(ordered);
  if (area < imageArea * 0.12 || area > imageArea * 0.985) return false;

  const margin = Math.min(width, height) * 0.01;
  for (const point of ordered) {
    if (
      point.x < -margin ||
      point.y < -margin ||
      point.x > width + margin ||
      point.y > height + margin
    ) {
      return false;
    }
  }

  const [tl, tr, br, bl] = ordered;
  if (!(tl.x < tr.x && bl.x < br.x && tl.y < bl.y && tr.y < br.y)) {
    return false;
  }

  const topWidth = tr.x - tl.x;
  const bottomWidth = br.x - bl.x;
  const leftHeight = bl.y - tl.y;
  const rightHeight = br.y - tr.y;
  if (topWidth < width * 0.2 || bottomWidth < width * 0.2) return false;
  if (leftHeight < height * 0.2 || rightHeight < height * 0.2) return false;

  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const current = ordered[i];
    const next = ordered[(i + 1) % 4];
    const following = ordered[(i + 2) % 4];
    const cross =
      (next.x - current.x) * (following.y - next.y) -
      (next.y - current.y) * (following.x - next.x);
    if (Math.abs(cross) < 1) continue;
    if (sign === 0) {
      sign = Math.sign(cross);
    } else if (Math.sign(cross) !== sign) {
      return false;
    }
  }

  return true;
}

export function detectCornersFromMask(
  mask: boolean[],
  width: number,
  height: number,
  luminanceValues: Float32Array,
): Point[] | null {
  let paperPixels = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      paperPixels += 1;
      sumX += x;
      sumY += y;
    }
  }

  if (paperPixels < width * height * 0.12) return null;

  const centroid = { x: sumX / paperPixels, y: sumY / paperPixels };
  const boundary = collectBoundaryPoints(mask, width, height);
  if (boundary.length < 20) return null;

  const edges = classifyEdgePoints(boundary, centroid);
  const topLine = fitLine(edges.top);
  const rightLine = fitLine(edges.right);
  const bottomLine = fitLine(edges.bottom);
  const leftLine = fitLine(edges.left);
  if (!topLine || !rightLine || !bottomLine || !leftLine) return null;

  const tl = intersectLines(topLine, leftLine);
  const tr = intersectLines(topLine, rightLine);
  const br = intersectLines(bottomLine, rightLine);
  const bl = intersectLines(bottomLine, leftLine);
  if (!tl || !tr || !br || !bl) return null;

  const corners = orderCorners([
    refineCorner(luminanceValues, mask, width, height, tl),
    refineCorner(luminanceValues, mask, width, height, tr),
    refineCorner(luminanceValues, mask, width, height, br),
    refineCorner(luminanceValues, mask, width, height, bl),
  ]);

  return isValidPaperQuad(corners, width, height) ? corners : null;
}

export function refineCornersOnImage(
  image: HTMLImageElement,
  points: Point[],
): Point[] | null {
  const analysis = createAnalysisImage(image);
  if (!analysis) return null;

  const scaled = points.map((point) => ({
    x: point.x * analysis.scale,
    y: point.y * analysis.scale,
  }));

  const ordered = orderCorners(scaled);
  const refined = ordered.map((corner) => {
    const radius = Math.max(4, Math.round(Math.min(analysis.width, analysis.height) * 0.05));
    let best = corner;
    let bestScore = -1;

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = Math.round(corner.x + dx);
        const y = Math.round(corner.y + dy);
        if (x <= 0 || y <= 0 || x >= analysis.width - 1 || y >= analysis.height - 1) {
          continue;
        }

        const score = gradientMagnitude(
          analysis.luminance,
          analysis.width,
          analysis.height,
          x,
          y,
        );
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }

    return best;
  });

  const natural = refined.map((point) => ({
    x: point.x / analysis.scale,
    y: point.y / analysis.scale,
  }));

  return isValidPaperQuad(
    refined,
    analysis.width,
    analysis.height,
  )
    ? natural
    : null;
}

export function detectPaperCorners(image: HTMLImageElement): Point[] | null {
  const analysis = createAnalysisImage(image);
  if (!analysis) return null;

  const { width, height, luminance: lum, rgba } = analysis;
  const corners = [
    samplePatch(rgba, lum, width, height, width * 0.08, height * 0.08, CORNER_PATCH_RATIO),
    samplePatch(
      rgba,
      lum,
      width,
      height,
      width * 0.92,
      height * 0.08,
      CORNER_PATCH_RATIO,
    ),
    samplePatch(
      rgba,
      lum,
      width,
      height,
      width * 0.08,
      height * 0.92,
      CORNER_PATCH_RATIO,
    ),
    samplePatch(
      rgba,
      lum,
      width,
      height,
      width * 0.92,
      height * 0.92,
      CORNER_PATCH_RATIO,
    ),
  ];
  const center = samplePatch(
    rgba,
    lum,
    width,
    height,
    width / 2,
    height / 2,
    CENTER_PATCH_RATIO,
  );

  const bgLum = median(corners.map((patch) => patch.lum));
  const paperLum = center.lum;
  if (paperLum - bgLum < 18) return null;

  let mask = buildPaperMask(analysis, center.rgb, paperLum, bgLum);
  mask = dilateMask(mask, width, height);
  mask = erodeMask(mask, width, height);
  mask = keepLargestComponent(mask, width, height);

  const detected = detectCornersFromMask(mask, width, height, lum);
  if (!detected) return null;

  const scale = 1 / analysis.scale;
  return detected.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));
}
