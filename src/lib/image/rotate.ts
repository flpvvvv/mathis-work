import type { Point } from "@/lib/image/perspective";

/** Quarter turns of the whole photo, clockwise. */
export type Rotation = 0 | 90 | 180 | 270;

export function normalizeRotation(degrees: number): Rotation {
  const wrapped = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
  return wrapped as Rotation;
}

export function rotatedSize(
  width: number,
  height: number,
  rotation: Rotation,
): { width: number; height: number } {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

/**
 * Maps a point from the unrotated frame into the frame turned `rotation`
 * degrees clockwise: the top-left corner (0, 0) is the top-right corner after
 * a 90° turn, and the bottom-left corner afterwards.
 */
export function rotatePoint(
  point: Point,
  rotation: Rotation,
  width: number,
  height: number,
): Point {
  switch (rotation) {
    case 90:
      return { x: height - point.y, y: point.x };
    case 180:
      return { x: width - point.x, y: height - point.y };
    case 270:
      return { x: point.y, y: width - point.x };
    default:
      return { x: point.x, y: point.y };
  }
}

/**
 * Maps points from the unrotated frame into the rotated frame, applying one
 * quarter turn at a time so the frame dimensions follow along.
 */
export function rotatePoints(
  points: Point[],
  rotation: Rotation,
  width: number,
  height: number,
): Point[] {
  let current = points.map((point) => ({ ...point }));
  let size = { width, height };

  for (let remaining = rotation; remaining >= 90; remaining -= 90) {
    current = current.map((point) =>
      rotatePoint(point, 90, size.width, size.height),
    );
    size = rotatedSize(size.width, size.height, 90);
  }

  return current;
}

/**
 * Draws `image` rotated into a context whose canvas is already sized to
 * `rotatedSize(drawWidth, drawHeight, rotation)`. Quarter turns land on pixel
 * centres, so they cost no sharpness.
 */
function drawRotatedImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  rotation: Rotation,
  drawWidth: number,
  drawHeight: number,
): void {
  context.save();
  switch (rotation) {
    case 90:
      context.translate(drawHeight, 0);
      context.rotate(Math.PI / 2);
      break;
    case 180:
      context.translate(drawWidth, drawHeight);
      context.rotate(Math.PI);
      break;
    case 270:
      context.translate(0, drawWidth);
      context.rotate(-Math.PI / 2);
      break;
    default:
      break;
  }
  context.drawImage(image, 0, 0, drawWidth, drawHeight);
  context.restore();
}

/**
 * Canvas holding the image rotated, optionally downscaled so its longest side
 * is `maxSize`. Returns the scale applied, so points in the natural rotated
 * frame can be mapped onto the canvas by multiplying by it.
 */
export function createRotatedSource(
  image: HTMLImageElement,
  rotation: Rotation,
  maxSize?: number,
): { canvas: HTMLCanvasElement; scale: number } {
  const scale = maxSize
    ? Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
    : 1;
  const drawWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const drawHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const size = rotatedSize(drawWidth, drawHeight, rotation);

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawRotatedImage(context, image, rotation, drawWidth, drawHeight);

  return { canvas, scale };
}
