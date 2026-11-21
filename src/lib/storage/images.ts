import { getSupabaseEnv } from "@/lib/env";

const BUCKET_NAME = "artworks";

export function getStoragePath(workId: string, imageId: string) {
  return `${workId}/${imageId}.jpg`;
}

export function getPublicImageUrl(storagePath: string) {
  const { url } = getSupabaseEnv();
  const normalizedPath = storagePath.startsWith(`${BUCKET_NAME}/`)
    ? storagePath.replace(`${BUCKET_NAME}/`, "")
    : storagePath;

  return `${url}/storage/v1/object/public/${BUCKET_NAME}/${normalizedPath}`;
}

/**
 * URL for an optimized variant served by Next's own image optimizer.
 *
 * Only use this where there is no `<Image>` component to do it: `<meta>` tags
 * are crawled by bots that never run our JS, and pointing them straight at
 * Storage made every crawler download the multi-megabyte original.
 *
 * `width` must be one of the widths in `images.deviceSizes` / `imageSizes` in
 * `next.config.ts`; the optimizer answers 400 for any other width.
 */
export function getOptimizedImageUrl(storagePath: string, width: number, quality = 75) {
  return `/_next/image?url=${encodeURIComponent(getPublicImageUrl(storagePath))}&w=${width}&q=${quality}`;
}

export { BUCKET_NAME };
