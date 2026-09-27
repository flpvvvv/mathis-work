"use client";

import { Loader2, Search, X } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { AnalyticsView } from "@/components/gallery/analytics-view";
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
import { Input } from "@/components/ui/input";
import type { GalleryStats } from "@/lib/data/stats";
import type { Work } from "@/lib/types";

type WorksResponse = {
  items: Work[];
  nextPage: number | null;
  total: number;
};

type Props = {
  initialData: WorksResponse;
  initialStats: GalleryStats | null;
  tags: string[];
  initialFilters: GalleryFiltersState;
  initialMode: ViewMode;
  modeFromQuery: boolean;
};

const VIEW_MODE_KEY = "mathis-gallery:view-mode";

function subscribeToStoredViewMode(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

const readStoredViewMode = (): ViewMode | null => {
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  return saved === "grid" || saved === "timeline" || saved === "analytics"
    ? saved
    : null;
};

const readServerViewMode = () => null;

const defaultFilters: GalleryFiltersState = {
  query: "",
  tags: [],
  from: "",
  to: "",
};

function filterParams(filters: GalleryFiltersState) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  return params;
}

function toSearchParams(filters: GalleryFiltersState, mode: ViewMode) {
  const params = filterParams(filters);
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
  const params = filterParams(filters);
  params.set("page", String(pageParam));
  params.set("pageSize", "20");

  const response = await fetch(`/api/works?${params.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch works");
  }

  return (await response.json()) as WorksResponse;
}

async function fetchStats(filters: GalleryFiltersState) {
  const params = filterParams(filters);
  const response = await fetch(`/api/stats?${params.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch stats");
  }

  return (await response.json()) as GalleryStats;
}

export function GalleryClient({
  initialData,
  initialStats,
  tags,
  initialFilters,
  initialMode,
  modeFromQuery,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const storedViewMode = useSyncExternalStore(
    subscribeToStoredViewMode,
    readStoredViewMode,
    readServerViewMode,
  );
  const [chosenViewMode, setChosenViewMode] = useState<ViewMode | null>(null);
  const viewMode: ViewMode =
    chosenViewMode ??
    (modeFromQuery ? initialMode : (storedViewMode ?? initialMode));
  const [filters, setFilters] = useState<GalleryFiltersState>(initialFilters);
  const [debouncedFilters, setDebouncedFilters] =
    useState<GalleryFiltersState>(initialFilters);

  useEffect(() => {
    if (chosenViewMode === null && !modeFromQuery && storedViewMode === null) {
      return;
    }
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [chosenViewMode, modeFromQuery, storedViewMode, viewMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[name="search"]',
        );
        input?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const params = toSearchParams(debouncedFilters, viewMode);
    // A deep link that arrived with an explicit mode keeps it; otherwise the
    // rewrite would drop `mode` and the stored preference would take over.
    if (viewMode === "grid" && modeFromQuery) {
      params.set("mode", "grid");
    }
    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [debouncedFilters, modeFromQuery, pathname, router, viewMode]);

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
    // The Analytics view never paginates, so the feed stays idle there.
    enabled: viewMode !== "analytics",
  });

  const statsQuery = useQuery({
    queryKey: ["stats", debouncedFilters],
    queryFn: () => fetchStats(debouncedFilters),
    initialData: filtersEqual(initialFilters, debouncedFilters)
      ? (initialStats ?? undefined)
      : undefined,
    enabled: viewMode === "analytics",
    // Server-rendered stats are current; do not refetch them on mount.
    staleTime: 60_000,
  });

  const stats = statsQuery.data ?? null;

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

  const hrefForRange = useCallback(
    ({ from, to }: { from: string; to: string }) => {
      const params = toSearchParams({ ...filters, from, to }, "grid");
      // Explicit: without `mode`, a stored "analytics" preference would keep
      // the reader here instead of opening the range in the Grid they asked for.
      params.set("mode", "grid");
      const serialized = params.toString();
      return serialized ? `/?${serialized}` : "/";
    },
    [filters],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl text-pretty md:text-5xl font-display uppercase tracking-tight font-bold drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
          Mathis&apos;s Artwork
        </h1>
        <ViewModeToggle mode={viewMode} onChange={setChosenViewMode} />
      </div>

      <div aria-label="Search artworks" className="relative" role="search">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--text-secondary)]"
        />
        <Input
          aria-label="Search artworks"
          autoComplete="off"
          className="h-12 pl-12 pr-12 text-base"
          enterKeyHint="search"
          inputMode="search"
          name="search"
          placeholder="Search artworks…"
          spellCheck={false}
          value={filters.query}
          onChange={(event) =>
            setFilters({ ...filters, query: event.target.value })
          }
        />
        {filters.query && (
          <button
            aria-label="Clear search"
            className="absolute right-1 top-1 bottom-1 grid aspect-square place-items-center transition-colors hover:bg-[var(--accent)] cursor-pointer"
            type="button"
            onClick={() => setFilters({ ...filters, query: "" })}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <GalleryFilters
        filters={filters}
        tags={tags}
        onChange={setFilters}
        onClear={() => setFilters(defaultFilters)}
      />

      {viewMode !== "analytics" &&
        (() => {
          const active = Boolean(
            debouncedFilters.query ||
              debouncedFilters.tags.length ||
              debouncedFilters.from ||
              debouncedFilters.to,
          );
          if (!active) return null;
          if (query.isFetching && !query.isFetchingNextPage) {
            return (
              <p
                aria-live="polite"
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
              >
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </p>
            );
          }
          return (
            <p
              aria-live="polite"
              className="text-sm text-[var(--text-secondary)]"
            >
              {works.length > 0
                ? `${works.length} ${works.length === 1 ? "work" : "works"} found`
                : "No works match your search"}
            </p>
          );
        })()}

      {viewMode === "grid" ? (
        <GridView backHref={backHref} works={works} />
      ) : viewMode === "timeline" ? (
        <TimelineView backHref={backHref} works={works} />
      ) : statsQuery.isError ? (
        <p className="rounded-none border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-secondary)]">
          Could not load statistics. Please try again.
        </p>
      ) : stats ? (
        <AnalyticsView
          filters={filters}
          hrefForRange={hrefForRange}
          stats={stats}
        />
      ) : (
        <p
          aria-live="polite"
          className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-secondary)]"
        >
          <Loader2 className="size-4 animate-spin" />
          Loading statistics…
        </p>
      )}

      {viewMode !== "analytics" && (
        <>
          <InfiniteLoader
            enabled={Boolean(query.hasNextPage)}
            onLoadMore={onLoadMore}
          />
          {query.isFetchingNextPage ? (
            <p
              aria-live="polite"
              className="text-center text-sm text-[var(--text-secondary)]"
            >
              Loading more…
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
