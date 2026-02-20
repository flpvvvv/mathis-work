import PerspT from "perspective-transform";

import type { JpegResult } from "@/lib/image/jpeg";

export type Point = {
  x: number;
  y: number;
};

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getOutputSize(points: Point[]) {
  const top = distance(points[0], points[1]);
  const right = distance(points[1], points[2]);
  const bottom = distance(points[2], points[3]);
  const left = distance(points[3], points[0]);

  return {
    width: Math.max(32, Math.round((top + bottom) / 2)),
    height: Math.max(32, Math.round((left + right) / 2)),
  };
}

function sampleBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);

  const dx = x - x0;
  const dy = y - y0;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  const rgba = [0, 0, 0, 255];
  for (let c = 0; c < 4; c += 1) {
    const top = data[i00 + c] * (1 - dx) + data[i10 + c] * dx;
    const bottom = data[i01 + c] * (1 - dx) + data[i11 + c] * dx;
    rgba[c] = Math.round(top * (1 - dy) + bottom * dy);
  }

  return rgba;
}

export function drawPerspectiveToCanvas(
  sourceCanvas: HTMLCanvasElement,
  points: Point[],
  outputCanvas: HTMLCanvasElement,
) {
  const sourceContext = sourceCanvas.getContext("2d");
  const outputContext = outputCanvas.getContext("2d");
  if (!sourceContext || !outputContext) {
    throw new Error("Canvas context is unavailable");
  }

  const { width: outputWidth, height: outputHeight } = getOutputSize(points);
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const sourceImageData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  const destination = outputContext.createImageData(outputWidth, outputHeight);

  const transform = PerspT(
    [
      points[0].x,
      points[0].y,
      points[1].x,
      points[1].y,
      points[2].x,
      points[2].y,
      points[3].x,
      points[3].y,
    ],
    [0, 0, outputWidth, 0, outputWidth, outputHeight, 0, outputHeight],
  );

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const [sourceX, sourceY] = transform.transformInverse(x, y);
      const destIndex = (y * outputWidth + x) * 4;

      if (
        sourceX < 0 ||
        sourceY < 0 ||
        sourceX >= sourceCanvas.width - 1 ||
        sourceY >= sourceCanvas.height - 1
      ) {
        destination.data[destIndex + 0] = 0;
        destination.data[destIndex + 1] = 0;
        destination.data[destIndex + 2] = 0;
        destination.data[destIndex + 3] = 0;
        continue;
      }

      const rgba = sampleBilinear(
        sourceImageData.data,
        sourceCanvas.width,
        sourceCanvas.height,
        sourceX,
        sourceY,
      );

      destination.data[destIndex + 0] = rgba[0];
      destination.data[destIndex + 1] = rgba[1];
      destination.data[destIndex + 2] = rgba[2];
      destination.data[destIndex + 3] = rgba[3];
    }
  }

  outputContext.putImageData(destination, 0, 0);
}

export async function correctPerspectiveToJpeg(
  image: HTMLImageElement,
  points: Point[],
  quality = 0.8,
): Promise<JpegResult> {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;

  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Canvas context is unavailable");
  }
  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const outputCanvas = document.createElement("canvas");
  drawPerspectiveToCanvas(sourceCanvas, points, outputCanvas);

  const blob = await new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (encodedBlob) => {
        if (!encodedBlob) {
          reject(new Error("Could not encode corrected image"));
          return;
        }
        resolve(encodedBlob);
      },
      "image/jpeg",
      quality,
    );
  });

  return {
    blob,
    width: outputCanvas.width,
    height: outputCanvas.height,
  };
}
