import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Aggregate statistics for the gallery "Analytics" view.
 *
 * The numbers are computed in one pass over every work that matches the
 * active filters, so the view always describes what the grid is showing.
 * Works come from plain PostgREST selects (same shape and filter semantics
 * as `getWorksPage`); `aggregateWorks` is pure and unit-tested.
 */

export type StatsFilters = {
  query?: string;
  tags?: string[];
  from?: string;
  to?: string;
};

export type StatsMonth = {
  /** `YYYY-MM`, continuous from the first to the last month with works. */
  key: string;
  count: number;
  /** Cover image storage paths, oldest first, capped at MAX_MONTH_COVERS. */
  covers: string[];
};

export type StatsTag = {
  name: string;
  count: number;
  firstMonth: string;
  lastMonth: string;
};

export type StatsDay = {
  /** `YYYY-MM-DD` */
  date: string;
  count: number;
  /** Cover image storage paths for that day, capped at MAX_DAY_COVERS. */
  covers: string[];
};

export type GalleryStats = {
  works: number;
  photos: number;
  tagsInUse: number;
  untaggedWorks: number;
  multiPhotoWorks: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Mean photos per work, 2 decimals. */
  photosPerWork: number;
  /** Mean tag links per work, 2 decimals. */
  tagsPerWork: number;
  /** Continuous month series, gaps included as `count: 0`. */
  months: StatsMonth[];
  activeMonths: number;
  /** Longest run of consecutive months with at least one work. */
  longestActiveStreak: number;
  /** Runs of empty months between the first and last work. */
  quietStretches: number;
  longestQuietStretch: { from: string; to: string; months: number } | null;
  busiestDay: StatsDay | null;
  runnerUpDay: StatsDay | null;
  /** Index 0 = Monday … 6 = Sunday. */
  weekday: number[];
  /** Photos-per-work histogram, ascending by photos. */
  imagesPerWork: { photos: number; works: number }[];
  /** Tags by works, descending, then by name. */
  tags: StatsTag[];
  latestYear: { year: number; works: number; perMonth: number } | null;
};

export const MAX_MONTH_COVERS = 8;
export const MAX_DAY_COVERS = 8;

/** Rows fetched per request; a PostgREST response is capped at 1000 rows. */
const FETCH_PAGE_SIZE = 1000;
/** Hard stop so a runaway table can never loop forever. */
const MAX_WORKS = 20000;

export type RawStatsWork = {
  id: string;
  created_date: string;
  cover_image_id: string | null;
  images:
    | { id: string; storage_path: string; display_order: number }[]
    | null;
  work_tags?:
    | {
        tags:
          | { name: string }
          | { name: string }[]
          | null;
      }[]
    | null;
};

/** `YYYY-MM` -> a month ordinal, so ranges can be walked without Date maths. */
const monthIndex = (key: string) => {
  const [year, month] = key.split("-");
  return Number(year) * 12 + Number(month) - 1;
};

const monthKeyFromIndex = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

const round2 = (value: number) => Math.round(value * 100) / 100;

function tagNames(item: RawStatsWork): string[] {
  const names = new Set<string>();
  for (const link of item.work_tags ?? []) {
    const tag = link?.tags;
    if (!tag) continue;
    if (Array.isArray(tag)) {
      for (const entry of tag) {
        if (entry?.name) names.add(entry.name);
      }
    } else if (tag.name) {
      names.add(tag.name);
    }
  }
  return Array.from(names);
}

function coverOf(item: RawStatsWork): string | null {
  const images = (item.images ?? [])
    .filter((image) => image?.storage_path)
    .toSorted((a, b) => a.display_order - b.display_order);
  if (images.length === 0) return null;
  const cover = images.find((image) => image.id === item.cover_image_id);
  return (cover ?? images[0]).storage_path;
}

export function aggregateWorks(rows: RawStatsWork[]): GalleryStats {
  const empty: GalleryStats = {
    works: 0,
    photos: 0,
    tagsInUse: 0,
    untaggedWorks: 0,
    multiPhotoWorks: 0,
    firstDate: null,
    lastDate: null,
    photosPerWork: 0,
    tagsPerWork: 0,
    months: [],
    activeMonths: 0,
    longestActiveStreak: 0,
    quietStretches: 0,
    longestQuietStretch: null,
    busiestDay: null,
    runnerUpDay: null,
    weekday: [0, 0, 0, 0, 0, 0, 0],
    imagesPerWork: [],
    tags: [],
    latestYear: null,
  };
  if (rows.length === 0) return empty;

  const sorted = rows.toSorted((a, b) =>
    a.created_date.localeCompare(b.created_date),
  );

  const monthCounts = new Map<string, number>();
  const coversByMonth = new Map<string, string[]>();
  const dayCounts = new Map<string, number>();
  const coversByDay = new Map<string, string[]>();
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const tagCounts = new Map<string, number>();
  const tagMonths = new Map<string, { first: string; last: string }>();
  const photoHistogram = new Map<number, number>();

  let photos = 0;
  let multiPhotoWorks = 0;
  let untaggedWorks = 0;
  let tagLinks = 0;

  for (const item of sorted) {
    const date = item.created_date;
    const month = date.slice(0, 7);

    const imageCount = (item.images ?? []).length;
    photos += imageCount;
    if (imageCount > 1) multiPhotoWorks += 1;
    photoHistogram.set(imageCount, (photoHistogram.get(imageCount) ?? 0) + 1);

    dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);

    const [year, monthNumber, day] = date.split("-").map(Number);
    const weekdayIndex =
      (new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay() + 6) % 7;
    weekday[weekdayIndex] += 1;

    const cover = coverOf(item);
    if (cover) {
      const monthCovers = coversByMonth.get(month);
      if (!monthCovers) {
        coversByMonth.set(month, [cover]);
      } else if (
        monthCovers.length < MAX_MONTH_COVERS &&
        !monthCovers.includes(cover)
      ) {
        monthCovers.push(cover);
      }

      const dayCovers = coversByDay.get(date);
      if (!dayCovers) {
        coversByDay.set(date, [cover]);
      } else if (
        dayCovers.length < MAX_DAY_COVERS &&
        !dayCovers.includes(cover)
      ) {
        dayCovers.push(cover);
      }
    }

    const names = tagNames(item);
    if (names.length === 0) untaggedWorks += 1;
    tagLinks += names.length;
    for (const name of names) {
      tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
      const seen = tagMonths.get(name);
      if (!seen) {
        tagMonths.set(name, { first: month, last: month });
      } else {
        if (month < seen.first) seen.first = month;
        if (month > seen.last) seen.last = month;
      }
    }
  }

  const firstDate = sorted[0].created_date;
  const lastDate = sorted[sorted.length - 1].created_date;

  const months: StatsMonth[] = [];
  for (
    let index = monthIndex(firstDate.slice(0, 7));
    index <= monthIndex(lastDate.slice(0, 7));
    index += 1
  ) {
    const key = monthKeyFromIndex(index);
    months.push({
      key,
      count: monthCounts.get(key) ?? 0,
      covers: coversByMonth.get(key) ?? [],
    });
  }

  let longestActiveStreak = 0;
  let currentStreak = 0;
  let quietStretches = 0;
  let currentQuiet = 0;
  let quietStart: string | null = null;
  let longestQuietStretch: GalleryStats["longestQuietStretch"] = null;

  for (let index = 0; index < months.length; index += 1) {
    if (months[index].count > 0) {
      currentStreak += 1;
      longestActiveStreak = Math.max(longestActiveStreak, currentStreak);
      if (currentQuiet > 0 && quietStart) {
        quietStretches += 1;
        if (!longestQuietStretch || currentQuiet > longestQuietStretch.months) {
          longestQuietStretch = {
            from: quietStart,
            to: months[index - 1].key,
            months: currentQuiet,
          };
        }
        currentQuiet = 0;
        quietStart = null;
      }
    } else {
      if (currentQuiet === 0) quietStart = months[index].key;
      currentQuiet += 1;
      currentStreak = 0;
    }
  }

  const days = Array.from(dayCounts, ([date, count]) => ({
    date,
    count,
    covers: coversByDay.get(date) ?? [],
  })).toSorted((a, b) => b.count - a.count || a.date.localeCompare(b.date));

  const lastYear = Number(lastDate.slice(0, 4));
  const lastYearWorks = sorted.filter((item) =>
    item.created_date.startsWith(`${lastYear}-`),
  ).length;

  return {
    works: sorted.length,
    photos,
    tagsInUse: tagCounts.size,
    untaggedWorks,
    multiPhotoWorks,
    firstDate,
    lastDate,
    photosPerWork: round2(photos / sorted.length),
    tagsPerWork: round2(tagLinks / sorted.length),
    months,
    activeMonths: months.filter((month) => month.count > 0).length,
    longestActiveStreak,
    quietStretches,
    longestQuietStretch,
    busiestDay: days[0] ?? null,
    runnerUpDay: days[1] ?? null,
    weekday,
    imagesPerWork: Array.from(photoHistogram, ([photosInWork, works]) => ({
      photos: photosInWork,
      works,
    })).toSorted((a, b) => a.photos - b.photos),
    tags: Array.from(tagCounts, ([name, count]) => ({
      name,
      count,
      firstMonth: tagMonths.get(name)?.first ?? "",
      lastMonth: tagMonths.get(name)?.last ?? "",
    })).toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    latestYear:
      lastYearWorks > 0
        ? {
            year: lastYear,
            works: lastYearWorks,
            perMonth: round2(lastYearWorks / Number(lastDate.slice(5, 7))),
          }
        : null,
  };
}

/** `null` = no tag filter, so every work matches. */
async function getMatchedWorkIds(
  filters: StatsFilters | undefined,
): Promise<string[] | null> {
  if (!filters?.tags?.length) return null;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_tags")
    .select("work_id,tags!inner(name)")
    .in("tags.name", filters.tags);
  if (error) {
    throw new Error(`Failed to load stats: ${error.message}`);
  }
  return Array.from(new Set((data ?? []).map((row) => row.work_id as string)));
}

export async function getGalleryStats(
  filters?: StatsFilters,
): Promise<GalleryStats> {
  try {
    const supabase = await getSupabaseServerClient();
    const matchedIds = await getMatchedWorkIds(filters);
    if (matchedIds && matchedIds.length === 0) {
      return aggregateWorks([]);
    }

    const rows: RawStatsWork[] = [];
    for (let offset = 0; offset < MAX_WORKS; offset += FETCH_PAGE_SIZE) {
      let query = supabase
        .from("works")
        .select(
          "id,created_date,cover_image_id,images!images_work_id_fkey(id,storage_path,display_order),work_tags(tags(name))",
        )
        .order("created_date", { ascending: true });

      if (filters?.query?.trim()) {
        query = query.textSearch("description_tsv", filters.query.trim(), {
          config: "simple",
          type: "websearch",
        });
      }
      if (filters?.from) {
        query = query.gte("created_date", filters.from);
      }
      if (filters?.to) {
        query = query.lte("created_date", filters.to);
      }
      if (matchedIds) {
        query = query.in("id", matchedIds);
      }

      const { data, error } = await query.range(
        offset,
        offset + FETCH_PAGE_SIZE - 1,
      );
      if (error) {
        throw new Error(`Failed to load stats: ${error.message}`);
      }

      const page = (data ?? []) as RawStatsWork[];
      rows.push(...page);
      if (page.length < FETCH_PAGE_SIZE) break;
    }

    return aggregateWorks(rows);
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Failed to load stats");
  }
}
