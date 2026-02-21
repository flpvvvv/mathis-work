import { getSupabaseEnv } from "@/lib/env";

const BUCKET_NAME = "artworks";

type TransformOptions = {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
};

export function getStoragePath(workId: string, imageId: string) {
  return `${workId}/${imageId}.jpg`;
}

export function getPublicImageUrl(
  storagePath: string,
  transform?: TransformOptions,
) {
  const { url } = getSupabaseEnv();
  const normalizedPath = storagePath.startsWith(`${BUCKET_NAME}/`)
    ? storagePath.replace(`${BUCKET_NAME}/`, "")
    : storagePath;

  const isRender = Boolean(transform?.width || transform?.height || transform?.resize);
  const endpoint = isRender ? "render/image/public" : "object/public";

  const imageUrl = new URL(
    `${url}/storage/v1/${endpoint}/${BUCKET_NAME}/${normalizedPath}`,
  );

  if (transform?.width) {
    imageUrl.searchParams.set("width", String(transform.width));
  }
  if (transform?.height) {
    imageUrl.searchParams.set("height", String(transform.height));
  }
  if (transform?.resize) {
    imageUrl.searchParams.set("resize", transform.resize);
  }

  return imageUrl.toString();
}

export { BUCKET_NAME };
