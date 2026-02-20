import { Suspense } from "react";

import { GalleryShell } from "@/components/gallery/gallery-shell";
import { GallerySkeleton } from "@/components/gallery/gallery-skeleton";

type Props = {
  searchParams: Promise<{
    query?: string;
    tags?: string;
    from?: string;
    to?: string;
    mode?: "grid" | "timeline";
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const initialFilters = {
    query: params.query ?? "",
    tags: (params.tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    from: params.from ?? "",
    to: params.to ?? "",
  };
  const modeFromQuery = params.mode === "grid" || params.mode === "timeline";
  const initialMode = params.mode === "timeline" ? "timeline" : "grid";

  return (
    <Suspense fallback={<GallerySkeleton />}>
      <GalleryShell
        initialFilters={initialFilters}
        initialMode={initialMode}
        modeFromQuery={modeFromQuery}
      />
    </Suspense>
  );
}
