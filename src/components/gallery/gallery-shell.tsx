import { GalleryClient } from "@/components/gallery/gallery-client";
import { getTagList, getWorksPage } from "@/lib/data/works";

type Props = {
  initialFilters: {
    query: string;
    tags: string[];
    from: string;
    to: string;
  };
  initialMode: "grid" | "timeline";
  modeFromQuery: boolean;
};

export async function GalleryShell({
  initialFilters,
  initialMode,
  modeFromQuery,
}: Props) {
  const [page, tags] = await Promise.all([
    getWorksPage({ page: 1, pageSize: 20, filters: initialFilters }),
    getTagList(),
  ]);

  return (
    <GalleryClient
      initialData={page}
      initialFilters={initialFilters}
      initialMode={initialMode}
      modeFromQuery={modeFromQuery}
      tags={tags}
    />
  );
}
