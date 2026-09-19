import type { Point } from "@/lib/image/perspective";

export function orderCorners(points: Point[]): Point[] {
  const sortedByY = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const top = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

export function polygonArea(points: Point[]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function polygonPerimeter(points: Point[]) {
  let perimeter = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    perimeter += Math.hypot(next.x - points[i].x, next.y - points[i].y);
  }
  return perimeter;
}

/** Rejects quads that are too small, off-frame, or not convex rectangles. */
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
