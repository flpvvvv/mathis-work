import type { Point } from "@/lib/image/perspective";
import {
  isValidPaperQuad,
  orderCorners,
  polygonArea,
  polygonPerimeter,
} from "@/lib/image/quad";

/** Percentile of the gradient magnitude treated as "a crisp edge". */
const EDGE_PERCENTILE = 0.92;
/** …and the near-peak percentile used to gauge the strongest edges present. */
const PEAK_PERCENTILE = 0.995;
/** Fractions of that level used as binarisation thresholds, tried in turn. */
const EDGE_THRESHOLD_RATIOS = [0.45, 0.65, 0.85];
const MIN_EDGE_LEVEL = 8;
/** Connected components smaller than this fraction of the frame are noise. */
const MIN_COMPONENT_RATIO = 0.002;
/** …and so are components that do not span at least this much of the frame. */
const MIN_SPAN_RATIO = 0.3;
/** Cap on the points fed to the convex hull, so a busy frame stays fast. */
const MAX_HULL_POINTS = 20_000;

const QUAD_SCORE_THRESHOLD = 0.42;
const AREA_WEIGHT = 0.3;
const EDGE_WEIGHT = 0.4;
const CONTRAST_WEIGHT = 0.3;
const EDGE_SAMPLES = 16;
/** How far inside/outside an edge the paper-vs-background probes sit. */
const CONTRAST_PROBE_RATIO = 0.02;
/** Luminance difference (0–255) that counts as full paper/background contrast. */
const CONTRAST_RANGE = 40;

type EdgeComponent = {
  hull: Point[];
  count: number;
  spanX: number;
  spanY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sobelMagnitude(
  lum: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const magnitude = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -lum[index - width - 1] -
        2 * lum[index - 1] -
        lum[index + width - 1] +
        lum[index - width + 1] +
        2 * lum[index + 1] +
        lum[index + width + 1];
      const gy =
        -lum[index - width - 1] -
        2 * lum[index - width] -
        lum[index - width + 1] +
        lum[index + width - 1] +
        2 * lum[index + width] +
        lum[index + width + 1];
      magnitude[index] = Math.hypot(gx, gy) / 4;
    }
  }

  return magnitude;
}

/** Robust magnitude level at `ratio`, via a histogram so large frames stay cheap. */
export function gradientScale(magnitude: Float32Array, ratio: number): number {
  const buckets = new Uint32Array(256);
  let count = 0;

  for (let index = 0; index < magnitude.length; index += 1) {
    const value = magnitude[index];
    if (value <= 0) continue;
    buckets[Math.min(255, Math.round(value))] += 1;
    count += 1;
  }

  if (count === 0) return 0;

  const target = count * ratio;
  let seen = 0;
  for (let value = 0; value < buckets.length; value += 1) {
    seen += buckets[value];
    if (seen >= target) return value;
  }
  return buckets.length - 1;
}

function binarizeEdges(
  magnitude: Float32Array,
  threshold: number,
): Uint8Array {
  const edges = new Uint8Array(magnitude.length);
  for (let index = 0; index < magnitude.length; index += 1) {
    edges[index] = magnitude[index] >= threshold ? 1 : 0;
  }
  return edges;
}

export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (origin: Point, a: Point, b: Point) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

  const half = (input: Point[]) => {
    const hull: Point[] = [];
    for (const point of input) {
      while (
        hull.length >= 2 &&
        cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
      ) {
        hull.pop();
      }
      hull.push(point);
    }
    return hull;
  };

  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function perpendicularDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return Math.hypot(point.x - start.x, point.y - start.y);
  return (
    Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) /
    length
  );
}

function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  let maxDistance = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[last]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= epsilon) return [points[0], points[last]];

  return [
    ...douglasPeucker(points.slice(0, index + 1), epsilon).slice(0, -1),
    ...douglasPeucker(points.slice(index), epsilon),
  ];
}

export function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length < 4) return points.map((point) => ({ ...point }));

  // Split the ring at the point farthest from the first one, so the segment
  // closing the ring is simplified as well.
  let farIndex = 0;
  let farDistance = -1;
  for (let i = 1; i < points.length; i += 1) {
    const distance = Math.hypot(
      points[i].x - points[0].x,
      points[i].y - points[0].y,
    );
    if (distance > farDistance) {
      farDistance = distance;
      farIndex = i;
    }
  }

  const first = points.slice(0, farIndex + 1);
  const second = [...points.slice(farIndex), points[0]];
  const simplified = [
    ...douglasPeucker(first, epsilon).slice(0, -1),
    ...douglasPeucker(second, epsilon).slice(0, -1),
  ];

  return simplified.length >= 4
    ? simplified
    : points.map((point) => ({ ...point }));
}

/** Drops the vertex whose removal costs the least area until four remain. */
function reduceToQuad(polygon: Point[]): Point[] | null {
  const current = polygon.map((point) => ({ ...point }));

  while (current.length > 4) {
    let bestIndex = 0;
    let bestArea = Infinity;

    for (let i = 0; i < current.length; i += 1) {
      const previous = current[(i - 1 + current.length) % current.length];
      const next = current[(i + 1) % current.length];
      const area =
        Math.abs(
          (current[i].x - previous.x) * (next.y - previous.y) -
            (next.x - previous.x) * (current[i].y - previous.y),
        ) / 2;
      if (area < bestArea) {
        bestArea = area;
        bestIndex = i;
      }
    }

    current.splice(bestIndex, 1);
  }

  return current.length === 4 ? orderCorners(current) : null;
}

/**
 * Fits a quadrilateral to an outline: the simplification tolerance is raised
 * until exactly four vertices survive, which is where the outline of a sheet of
 * paper lands.
 */
export function quadFromPolygon(polygon: Point[]): Point[] | null {
  if (polygon.length < 4) return null;
  if (polygon.length === 4) return orderCorners(polygon);

  const perimeter = polygonPerimeter(polygon);
  if (perimeter <= 0) return null;

  for (let step = 1; step <= 40; step += 1) {
    const simplified = simplifyPolygon(polygon, perimeter * 0.004 * step);
    if (simplified.length === 4) return orderCorners(simplified);
    if (simplified.length < 4) break;
  }

  return reduceToQuad(polygon);
}

function sampleLuminance(
  values: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const cx = clamp(Math.round(x), 0, width - 1);
  const cy = clamp(Math.round(y), 0, height - 1);
  return values[cy * width + cx];
}

function medianOf(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Scores a candidate quad from 0 to 1: how much of the frame it covers, how
 * much its edges stand out from the texture just inside them, and how much
 * brighter its inside is than the band just outside it (a sheet of paper is the
 * bright side). Medians rather than means, so a stroke crossing the sampled
 * line does not decide the score.
 */
export function scoreQuad(
  quad: Point[],
  lum: Float32Array,
  magnitude: Float32Array,
  edgeScale: number,
  width: number,
  height: number,
): number {
  if (edgeScale <= 0) return 0;

  const ordered = orderCorners(quad);
  const areaFraction = clamp(polygonArea(ordered) / (width * height), 0, 1);
  const probe = Math.max(2, Math.min(width, height) * CONTRAST_PROBE_RATIO);

  const edgeMagnitudes: number[] = [];
  const insideMagnitudes: number[] = [];
  const insideLuminance: number[] = [];
  const outsideLuminance: number[] = [];

  for (let edge = 0; edge < 4; edge += 1) {
    const start = ordered[edge];
    const end = ordered[(edge + 1) % 4];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 1e-6) continue;

    // Outward normal of the ring as ordered by `orderCorners` in screen
    // coordinates, where +y points down.
    const ox = (end.y - start.y) / length;
    const oy = -(end.x - start.x) / length;

    for (let step = 1; step <= EDGE_SAMPLES; step += 1) {
      const t = step / (EDGE_SAMPLES + 1);
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;

      edgeMagnitudes.push(
        sampleLuminance(magnitude, width, height, x, y),
      );
      insideMagnitudes.push(
        sampleLuminance(
          magnitude,
          width,
          height,
          x - ox * probe * 2,
          y - oy * probe * 2,
        ),
      );
      insideLuminance.push(
        sampleLuminance(lum, width, height, x - ox * probe, y - oy * probe),
      );
      outsideLuminance.push(
        sampleLuminance(lum, width, height, x + ox * probe, y + oy * probe),
      );
    }
  }

  if (edgeMagnitudes.length === 0) return 0;

  const edgeSupport = clamp(
    (medianOf(edgeMagnitudes) - medianOf(insideMagnitudes)) / edgeScale,
    0,
    1,
  );
  const paperContrast = clamp(
    (medianOf(insideLuminance) - medianOf(outsideLuminance)) / CONTRAST_RANGE,
    0,
    1,
  );

  return (
    AREA_WEIGHT * areaFraction +
    EDGE_WEIGHT * edgeSupport +
    CONTRAST_WEIGHT * paperContrast
  );
}

/**
 * Traces the connected components of the gradient image and fits a quad to
 * each outline. Unlike a brightness threshold this survives uneven light, which
 * is what fails on photos taken with a lamp on one side of the paper.
 */
function findEdgeComponents(
  edges: Uint8Array,
  width: number,
  height: number,
): EdgeComponent[] {
  const visited = new Uint8Array(width * height);
  const components: EdgeComponent[] = [];
  const stack: number[] = [];
  const indices: number[] = [];

  for (let start = 0; start < edges.length; start += 1) {
    if (!edges[start] || visited[start]) continue;

    stack.length = 0;
    indices.length = 0;
    stack.push(start);
    visited[start] = 1;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (stack.length > 0) {
      const index = stack.pop();
      if (index === undefined) break;
      const x = index % width;
      const y = (index - x) / width;
      indices.push(index);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (!edges[neighbor] || visited[neighbor]) continue;
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }

    const stride = Math.max(1, Math.ceil(indices.length / MAX_HULL_POINTS));
    const points: Point[] = [];
    for (let i = 0; i < indices.length; i += stride) {
      const x = indices[i] % width;
      points.push({ x, y: (indices[i] - x) / width });
    }

    components.push({
      hull: convexHull(points),
      count: indices.length,
      spanX: maxX - minX,
      spanY: maxY - minY,
    });
  }

  return components;
}

/** Best paper quad found from the gradient image, or null when nothing scores. */
export function detectQuadFromEdges(
  lum: Float32Array,
  magnitude: Float32Array,
  width: number,
  height: number,
): Point[] | null {
  // A quiet frame can have a low 92nd percentile yet still contain a crisp
  // sheet edge, so the near-peak level both gates and normalises the search.
  const peakScale = gradientScale(magnitude, PEAK_PERCENTILE);
  if (peakScale < MIN_EDGE_LEVEL) return null;

  const strongScale = Math.max(
    gradientScale(magnitude, EDGE_PERCENTILE),
    peakScale * 0.5,
    MIN_EDGE_LEVEL,
  );

  const minSpan = Math.min(width, height) * MIN_SPAN_RATIO;
  const minPixels = width * height * MIN_COMPONENT_RATIO;
  let best: Point[] | null = null;
  let bestScore = 0;

  for (const ratio of EDGE_THRESHOLD_RATIOS) {
    const threshold = Math.max(MIN_EDGE_LEVEL, strongScale * ratio);
    const components = findEdgeComponents(
      binarizeEdges(magnitude, threshold),
      width,
      height,
    );

    for (const component of components) {
      if (component.count < minPixels) continue;
      if (component.spanX < minSpan || component.spanY < minSpan) continue;

      const quad = quadFromPolygon(component.hull);
      if (!quad || !isValidPaperQuad(quad, width, height)) continue;

      const score = scoreQuad(quad, lum, magnitude, strongScale, width, height);
      if (score > bestScore) {
        bestScore = score;
        best = quad;
      }
    }
  }

  return bestScore >= QUAD_SCORE_THRESHOLD ? best : null;
}
