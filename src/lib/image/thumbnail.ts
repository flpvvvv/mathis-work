import { loadImageFromBlob } from "@/lib/image/jpeg";

const MAX_EDGE = 480;
const QUALITY = 0.75;

/**
 * Small self-contained preview for an image that is not in storage yet.
 *
 * Returns a data URL rather than a blob URL: a blob URL has to be revoked when
 * its component unmounts, which React StrictMode breaks (the remount keeps
 * using the already-revoked URL). The data URL carries its own pixels and
 * survives re-renders and remounts.
 */
export async function createThumbnailUrl(source: Blob): Promise<string> {
  const image = await loadImageFromBlob(source);
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}
