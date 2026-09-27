import { describe, expect, it } from "vitest";

import {
  MAX_MONTH_COVERS,
  aggregateWorks,
  type RawStatsWork,
} from "@/lib/data/stats";

function work(
  createdDate: string,
  options: {
    tags?: string[];
    images?: { id: string; storage_path: string; display_order: number }[];
    coverImageId?: string | null;
  } = {},
): RawStatsWork {
  return {
    id: createdDate,
    created_date: createdDate,
    cover_image_id: options.coverImageId ?? null,
    images: options.images ?? [
      { id: "img-1", storage_path: `${createdDate}/1.jpg`, display_order: 0 },
    ],
    work_tags: (options.tags ?? []).map((name) => ({ tags: { name } })),
  };
}

describe("aggregateWorks", () => {
  it("returns an empty summary for no works", () => {
    const stats = aggregateWorks([]);

    expect(stats.works).toBe(0);
    expect(stats.months).toEqual([]);
    expect(stats.busiestDay).toBeNull();
    expect(stats.latestYear).toBeNull();
    expect(stats.weekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("counts works, photos and multi-photo works", () => {
    const stats = aggregateWorks([
      work("2026-07-01", {
        images: [
          { id: "a", storage_path: "w/a.jpg", display_order: 0 },
          { id: "b", storage_path: "w/b.jpg", display_order: 1 },
          { id: "c", storage_path: "w/c.jpg", display_order: 2 },
        ],
      }),
      work("2026-07-02"),
      work("2026-07-03"),
    ]);

    expect(stats.works).toBe(3);
    expect(stats.photos).toBe(5);
    expect(stats.multiPhotoWorks).toBe(1);
    expect(stats.photosPerWork).toBe(1.67);
    expect(stats.imagesPerWork).toEqual([
      { photos: 1, works: 2 },
      { photos: 3, works: 1 },
    ]);
  });

  it("fills the month series with zero months and reports quiet stretches", () => {
    const stats = aggregateWorks([
      work("2025-02-10"),
      work("2025-02-11"),
      work("2025-04-01"),
      work("2025-09-30"),
      work("2026-01-05"),
      work("2026-02-05"),
    ]);

    expect(stats.months.map((month) => month.key)).toEqual([
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(stats.months.map((month) => month.count)).toEqual([
      2, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1,
    ]);
    expect(stats.activeMonths).toBe(5);
    expect(stats.quietStretches).toBe(3);
    expect(stats.longestQuietStretch).toEqual({
      from: "2025-05",
      to: "2025-08",
      months: 4,
    });
    expect(stats.longestActiveStreak).toBe(2);
    expect(stats.firstDate).toBe("2025-02-10");
    expect(stats.lastDate).toBe("2026-02-05");
  });

  it("ignores empty months before the first and after the last work", () => {
    const stats = aggregateWorks([work("2026-03-01"), work("2026-05-01")]);

    expect(stats.months.map((month) => month.key)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
    expect(stats.quietStretches).toBe(1);
    expect(stats.longestQuietStretch).toEqual({
      from: "2026-04",
      to: "2026-04",
      months: 1,
    });
  });

  it("buckets weekdays Monday-first", () => {
    const stats = aggregateWorks([
      work("2025-02-10"),
      work("2026-07-17"),
      work("2026-07-18"),
      work("2026-08-17"),
    ]);

    expect(stats.weekday).toEqual([2, 0, 0, 0, 1, 1, 0]);
  });

  it("picks the busiest day and a deterministic runner-up", () => {
    const stats = aggregateWorks([
      work("2026-07-17"),
      work("2026-07-17"),
      work("2026-07-17"),
      work("2026-08-17"),
      work("2026-08-17"),
      work("2026-09-01"),
      work("2026-09-01"),
    ]);

    expect(stats.busiestDay).toEqual({
      date: "2026-07-17",
      count: 3,
      covers: ["2026-07-17/1.jpg"],
    });
    expect(stats.runnerUpDay).toEqual({
      date: "2026-08-17",
      count: 2,
      covers: ["2026-08-17/1.jpg"],
    });
  });

  it("counts tags, their first and last month, and untagged works", () => {
    const stats = aggregateWorks([
      work("2026-01-01", { tags: ["线条", "颜色"] }),
      work("2026-03-01", { tags: ["线条"] }),
      work("2026-09-01", { tags: ["文字"] }),
      work("2026-09-02"),
    ]);

    expect(stats.tags).toEqual([
      { name: "线条", count: 2, firstMonth: "2026-01", lastMonth: "2026-03" },
      { name: "文字", count: 1, firstMonth: "2026-09", lastMonth: "2026-09" },
      { name: "颜色", count: 1, firstMonth: "2026-01", lastMonth: "2026-01" },
    ]);
    expect(stats.tagsInUse).toBe(3);
    expect(stats.untaggedWorks).toBe(1);
    expect(stats.tagsPerWork).toBe(1);
  });

  it("prefers the chosen cover, falls back to display order, and caps month covers", () => {
    const many = Array.from({ length: MAX_MONTH_COVERS + 4 }, (_, index) =>
      work(`2026-07-${String(index + 1).padStart(2, "0")}`, {
        images: [
          { id: "second", storage_path: `2026-07/${index}-2.jpg`, display_order: 1 },
          { id: "first", storage_path: `2026-07/${index}-1.jpg`, display_order: 0 },
        ],
        coverImageId: "second",
      }),
    );
    const stats = aggregateWorks(many);

    expect(stats.months[0].covers).toHaveLength(MAX_MONTH_COVERS);
    expect(stats.months[0].covers[0]).toBe("2026-07/0-2.jpg");

    const fallback = aggregateWorks([
      work("2026-07-01", {
        images: [
          { id: "later", storage_path: "2026-07/later.jpg", display_order: 9 },
          { id: "earlier", storage_path: "2026-07/earlier.jpg", display_order: 1 },
        ],
        coverImageId: "missing",
      }),
    ]);
    expect(fallback.months[0].covers).toEqual(["2026-07/earlier.jpg"]);
  });

  it("reports the latest year's pace from the last work's month", () => {
    const stats = aggregateWorks([
      work("2025-12-01"),
      work("2026-01-01"),
      work("2026-02-01"),
      work("2026-03-01"),
    ]);

    expect(stats.latestYear).toEqual({ year: 2026, works: 3, perMonth: 1 });
  });

  it("sorts works by date so the series is stable regardless of input order", () => {
    const stats = aggregateWorks([
      work("2026-03-01"),
      work("2026-01-01"),
      work("2026-02-01"),
    ]);

    expect(stats.months.map((month) => month.key)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(stats.firstDate).toBe("2026-01-01");
  });
});
