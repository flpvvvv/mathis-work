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

export { BUCKET_NAME };
