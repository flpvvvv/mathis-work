export function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  );
}

export function resolveCoverImageId(
  images: { id: string }[],
  selectedCover: string | null,
) {
  if (selectedCover && images.some((image) => image.id === selectedCover)) {
    return selectedCover;
  }
  return images[0]?.id ?? null;
}
