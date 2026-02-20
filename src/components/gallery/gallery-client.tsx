"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  GalleryFilters,
  type GalleryFiltersState,
} from "@/components/gallery/gallery-filters";
import { GridView } from "@/components/gallery/grid-view";
import { InfiniteLoader } from "@/components/gallery/infinite-loader";
import { TimelineView } from "@/components/gallery/timeline-view";
import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/gallery/view-mode-toggle";
import type { Work } from "@/lib/types";

type WorksResponse = {
  items: Work[];
  nextPage: number | null;
  total: number;
};

type Props = {
  initialData: WorksResponse;
  tags: string[];
  initialFilters: GalleryFiltersState;
  initialMode: ViewMode;
  modeFromQuery: boolean;
};

const VIEW_MODE_KEY = "mathis-gallery:view-mode";

const defaultFilters: GalleryFiltersState = {
  query: "",
  tags: [],
  from: "",
  to: "",
};

function toSearchParams(filters: GalleryFiltersState, mode: ViewMode) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (mode !== "grid") params.set("mode", mode);
  return params;
}

function filtersEqual(a: GalleryFiltersState, b: GalleryFiltersState) {
  return (
    a.query === b.query &&
    a.from === b.from &&
    a.to === b.to &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  );
}

async function fetchWorks({
  pageParam = 1,
  filters,
}: {
  pageParam?: number;
  filters: GalleryFiltersState;
}) {
  const params = new URLSearchParams({
    page: String(pageParam),
    pageSize: "20",
  });
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));

  const response = await fetch(`/api/works?${params.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch works");
  }

  return (await response.json()) as WorksResponse;
}

export function GalleryClient({
  initialData,
  tags,
  initialFilters,
  initialMode,
  modeFromQuery,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [filters, setFilters] = useState<GalleryFiltersState>(initialFilters);
  const [debouncedFilters, setDebouncedFilters] =
    useState<GalleryFiltersState>(initialFilters);

  useEffect(() => {
    if (!modeFromQuery) {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "grid" || saved === "timeline") {
        setViewMode(saved);
      }
    }
  }, [modeFromQuery]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const params = toSearchParams(debouncedFilters, viewMode);
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [debouncedFilters, pathname, router, viewMode]);

  const query = useInfiniteQuery({
    queryKey: ["works", debouncedFilters],
    queryFn: ({ pageParam }) =>
      fetchWorks({
        pageParam: pageParam as number,
        filters: debouncedFilters,
      }),
    initialPageParam: 1,
    initialData: filtersEqual(initialFilters, debouncedFilters)
      ? {
          pageParams: [1],
          pages: [initialData],
        }
      : undefined,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const works = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data?.pages],
  );

  const onLoadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const backHref = useMemo(() => {
    const params = toSearchParams(filters, viewMode);
    const serialized = params.toString();
    return serialized ? `/?${serialized}` : "/";
  }, [filters, viewMode]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl md:text-5xl font-display uppercase tracking-tight font-bold drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">Mathis&apos;s Artwork</h1>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <GalleryFilters
        filters={filters}
        tags={tags}
        onChange={setFilters}
        onClear={() => setFilters(defaultFilters)}
      />

      {viewMode === "grid" ? (
        <GridView backHref={backHref} works={works} />
      ) : (
        <TimelineView backHref={backHref} works={works} />
      )}

      <InfiniteLoader enabled={Boolean(query.hasNextPage)} onLoadMore={onLoadMore} />
      {query.isFetchingNextPage ? (
        <p className="text-center text-sm text-[var(--text-secondary)]">Loading more...</p>
      ) : null}
    </section>
  );
}
