export type JpegResult = {
  blob: Blob;
  width: number;
  height: number;
};

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const { promise, resolve, reject } =
      Promise.withResolvers<HTMLImageElement>();
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = objectUrl;
    return await promise;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  const { promise, resolve } = Promise.withResolvers<Blob | null>();
  canvas.toBlob(resolve, "image/jpeg", quality);

  const blob = await promise;
  if (!blob) {
    throw new Error("Could not encode image");
  }
  return blob;
}

export async function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality = 0.8,
): Promise<JpegResult> {
  return {
    blob: await canvasToBlob(canvas, quality),
    width: canvas.width,
    height: canvas.height,
  };
}

export async function reencodeToJpeg(
  source: Blob,
  quality = 0.8,
): Promise<JpegResult> {
  const image = await loadImageFromBlob(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas, quality);
}
