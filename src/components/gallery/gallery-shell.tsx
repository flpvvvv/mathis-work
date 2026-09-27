import { GalleryClient } from "@/components/gallery/gallery-client";
import type { ViewMode } from "@/components/gallery/view-mode-toggle";
import { getGalleryStats } from "@/lib/data/stats";
import { getTagList, getWorksPage } from "@/lib/data/works";

type Props = {
  initialFilters: {
    query: string;
    tags: string[];
    from: string;
    to: string;
  };
  initialMode: ViewMode;
  modeFromQuery: boolean;
};

export async function GalleryShell({
  initialFilters,
  initialMode,
  modeFromQuery,
}: Props) {
  const [page, tags, stats] = await Promise.all([
    getWorksPage({ page: 1, pageSize: 20, filters: initialFilters }),
    getTagList(),
    initialMode === "analytics"
      ? getGalleryStats(initialFilters)
      : Promise.resolve(null),
  ]);

  return (
    <GalleryClient
      initialData={page}
      initialFilters={initialFilters}
      initialMode={initialMode}
      initialStats={stats}
      modeFromQuery={modeFromQuery}
      tags={tags}
    />
  );
}
