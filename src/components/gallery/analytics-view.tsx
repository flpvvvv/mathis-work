"use client";

import Image from "next/image";
import { Fragment, useState } from "react";

import type { GalleryFiltersState } from "@/components/gallery/gallery-filters";
import type { GalleryStats, StatsMonth } from "@/lib/data/stats";
import { getPublicImageUrl } from "@/lib/storage/images";

const monthFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});
const monthYearFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const PANEL =
  "border-2 border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-brutal)] md:p-5";
const PANEL_HEAD = "mb-3 flex flex-wrap items-baseline justify-between gap-2";
const PANEL_TITLE = "font-display text-lg uppercase tracking-wide";
const META =
  "font-mono text-[0.64rem] uppercase tracking-wider text-[var(--text-secondary)]";
const FACTS = "mt-2 space-y-0";
const FACT_ROW =
  "flex justify-between gap-3 border-b-2 border-dashed border-[var(--border)] py-1.5 text-[0.8rem] last:border-b-0";
const GHOST_LINK =
  "inline-block border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-wider shadow-[var(--shadow-brutal-sm)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)] focus-visible:ring-offset-2 motion-reduce:transition-none";

const TILE_TONES = {
  primary: "bg-[var(--primary)] text-black",
  secondary: "bg-[var(--secondary)] text-black",
  accent: "bg-[var(--accent)] text-black",
  surface: "bg-[var(--surface)]",
} as const;

const BLOB_TONES = [
  "bg-[var(--primary)] text-black",
  "bg-[var(--secondary)] text-black",
  "bg-[var(--accent)] text-black",
  "bg-[var(--surface)]",
  "bg-[var(--surface)]",
];

const BLOB_POSITIONS = [
  { left: 3, top: 22 },
  { left: 25, top: 6 },
  { left: 47, top: 56 },
  { left: 55, top: 14 },
  { left: 72, top: 58 },
];

function formatMonth(key: string) {
  return monthFormat.format(
    new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)),
  );
}

function formatMonthYear(key: string) {
  return monthYearFormat.format(
    new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)),
  );
}

function formatDay(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

function monthRange(key: string) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${key}-01`, to: `${key}-${String(lastDay).padStart(2, "0")}` };
}

function monthLevelClass(count: number) {
  if (count === 0) return "border-dashed bg-transparent text-[var(--text-secondary)]";
  if (count <= 4) return "bg-[var(--accent)] text-black";
  if (count <= 9) return "bg-[var(--secondary)] text-black";
  return "bg-[var(--primary)] text-black";
}

function barTone(count: number, maxCount: number, isCurrent: boolean, isIsolated: boolean) {
  if (count === maxCount) return "bg-[var(--primary)]";
  if (isCurrent) return "bg-[var(--accent)]";
  if (isIsolated) return "hatch";
  return "bg-[var(--surface)]";
}

function percent(value: number, max: number) {
  return `${Math.max(2, Math.round((value / max) * 100))}%`;
}

type Props = {
  filters: GalleryFiltersState;
  stats: GalleryStats;
  /** Builds a Grid-view link constrained to a date range. */
  hrefForRange: (range: { from: string; to: string }) => string;
};

export function AnalyticsView({ filters, stats, hrefForRange }: Props) {
  const lastMonthKey = stats.months.at(-1)?.key ?? "";
  const [selectedMonth, setSelectedMonth] = useState(lastMonthKey);

  if (stats.works === 0) {
    return (
      <div className="rounded-none border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-secondary)]">
        No works found for these filters.
      </div>
    );
  }

  const maxCount = Math.max(...stats.months.map((month) => month.count));
  const activeMonths = stats.months.filter((month) => month.count > 0);
  const activeIndexes = stats.months
    .map((month, index) => (month.count > 0 ? index : -1))
    .filter((index) => index >= 0);
  const isolatedKeys = new Set(
    activeIndexes
      .filter((index, position) => {
        const previous = activeIndexes[position - 1];
        const next = activeIndexes[position + 1];
        return (
          (previous === undefined || index - previous >= 2) &&
          (next === undefined || next - index >= 2)
        );
      })
      .map((index) => stats.months[index].key),
  );

  const lastSixMonths = stats.months.slice(-6).reverse();
  const topMonths = activeMonths.toSorted((a, b) => b.count - a.count).slice(0, 2);
  const topMonthsTotal = topMonths.reduce((sum, month) => sum + month.count, 0);
  const otherActiveMonths = activeMonths.length - topMonths.length;
  const pulseNote =
    topMonths.length === 2
      ? `${formatMonthYear(topMonths[0].key)} and ${formatMonthYear(topMonths[1].key)} hold ${topMonthsTotal} of ${stats.works} works — the other ${otherActiveMonths} active months share the rest.`
      : `${stats.works} works across ${activeMonths.length} months.`;

  const monthsByKey = new Map(stats.months.map((month) => [month.key, month]));
  const selected = monthsByKey.get(selectedMonth);
  const unfoldMonth: StatsMonth | undefined =
    selected ?? activeMonths.at(-1) ?? stats.months.at(-1);
  const years = Array.from(
    new Set(stats.months.map((month) => month.key.slice(0, 4))),
  );

  const busiest = stats.busiestDay;
  const weekdayMax = Math.max(...stats.weekday);
  const tagTotal = stats.tags.reduce((sum, tag) => sum + tag.count, 0);
  const scopeLabel = filters.tags.length
    ? `Filtered: ${filters.tags.join(", ")}`
    : filters.query.trim()
      ? `Search: ${filters.query.trim()}`
      : filters.from || filters.to
        ? "Date range"
        : "Whole gallery";

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-[0.78rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        <span>
          {stats.firstDate ? formatDay(stats.firstDate) : ""} →{" "}
          {stats.lastDate ? formatDay(stats.lastDate) : ""} · {stats.activeMonths}{" "}
          active months
        </span>
        <span>{scopeLabel}</span>
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section
          aria-label="Key figures"
          className="grid grid-cols-2 gap-3 motion-safe:animate-fade-in-up motion-safe:opacity-0 md:grid-cols-4 md:gap-4 lg:col-span-12 lg:row-start-1"
        >
          <div
            className={`border-[3px] border-[var(--border)] p-3.5 shadow-[var(--shadow-brutal-sm)] ${TILE_TONES.primary}`}
          >
            <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-widest opacity-75">
              Works
            </p>
            <p className="font-display text-4xl leading-none">{stats.works}</p>
            <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-wide">
              {stats.firstDate ? `Since ${formatDay(stats.firstDate)}` : ""}
            </p>
          </div>
          <div
            className={`border-[3px] border-[var(--border)] p-3.5 shadow-[var(--shadow-brutal-sm)] ${TILE_TONES.secondary}`}
          >
            <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-widest opacity-75">
              Photographs
            </p>
            <p className="font-display text-4xl leading-none">{stats.photos}</p>
            <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-wide">
              {stats.photosPerWork} per work
            </p>
          </div>
          <div
            className={`border-[3px] border-[var(--border)] p-3.5 shadow-[var(--shadow-brutal-sm)] ${TILE_TONES.accent}`}
          >
            <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-widest opacity-75">
              Tags
            </p>
            <p className="font-display text-4xl leading-none">{stats.tagsInUse}</p>
            <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-wide">
              {stats.tagsPerWork} per work
            </p>
          </div>
          <div
            className={`border-[3px] border-[var(--border)] p-3.5 shadow-[var(--shadow-brutal-sm)] ${TILE_TONES.surface}`}
          >
            <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-widest opacity-75">
              Works with &gt;1 photo
            </p>
            <p className="font-display text-4xl leading-none">
              {stats.multiPhotoWorks}
            </p>
            <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-wide">
              {Math.round((stats.multiPhotoWorks / stats.works) * 100)}% of works
            </p>
          </div>
        </section>

        <section
          aria-labelledby="analytics-pulse"
          className={`${PANEL} motion-safe:animate-fade-in-up motion-safe:opacity-0 lg:col-span-8 lg:col-start-1 lg:row-start-2`}
          style={{ animationDelay: "0.05s" }}
        >
          <header className={PANEL_HEAD}>
            <h2 className={PANEL_TITLE} id="analytics-pulse">
              Output over time
            </h2>
            <p className={`${META} hidden items-center gap-3 lg:flex`}>
              <span>
                <i className="mr-1.5 inline-block size-2.5 border-2 border-[var(--border)] bg-[var(--primary)] align-[-1px]" />
                peak
              </span>
              <span>
                <i className="mr-1.5 inline-block size-2.5 border-2 border-[var(--border)] bg-[var(--accent)] align-[-1px]" />
                latest month
              </span>
              <span>
                <i className="hatch mr-1.5 inline-block size-2.5 border-2 border-[var(--border)] align-[-1px]" />
                isolated
              </span>
            </p>
            <p className={`${META} lg:hidden`}>
              last 6 months · {stats.activeMonths} active of {stats.months.length}
            </p>
          </header>

          <div className="hidden lg:block">
            <div className="flex h-[210px] items-end gap-2 border-b-2 border-[var(--border)]">
              {activeMonths.map((month) => (
                <div
                  key={month.key}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${formatMonthYear(month.key)}: ${month.count} works`}
                >
                  <span className="font-display text-[0.9rem] leading-none">
                    {month.count}
                  </span>
                  <div
                    className={`w-full border-2 border-[var(--border)] shadow-[var(--shadow-brutal-sm)] ${
                      barTone(
                        month.count,
                        maxCount,
                        month.key === lastMonthKey,
                        isolatedKeys.has(month.key),
                      )
                    }`}
                    style={{ height: percent(month.count, maxCount) }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {activeMonths.map((month, index) => (
                <span
                  key={month.key}
                  className="flex-1 truncate text-center font-mono text-[0.6rem] uppercase tracking-wide text-[var(--text-secondary)]"
                >
                  {formatMonth(month.key)}
                  {month.key.endsWith("-01") || index === 0
                    ? ` ${month.key.slice(2, 4)}`
                    : ""}
                </span>
              ))}
            </div>
          </div>

          <ol className="lg:hidden">
            {lastSixMonths.map((month) => (
              <li
                key={month.key}
                className="grid grid-cols-[5.4rem_1.8rem_1fr] items-center gap-3 border-b-2 border-[var(--border)] py-1.5 last:border-b-0"
              >
                <span className={META}>{formatMonthYear(month.key)}</span>
                <span className="text-right font-display text-lg leading-none tabular-nums">
                  {month.count}
                </span>
                <span className="block h-3.5 border-2 border-[var(--border)] bg-[var(--background)]">
                  <span
                    className={`block h-full ${
                      month.count === maxCount
                        ? "bg-[var(--primary)]"
                        : month.key === lastMonthKey
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--secondary)]"
                    }`}
                    style={{ width: percent(month.count, maxCount) }}
                  />
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-[0.82rem] text-[var(--text-secondary)]">
            {pulseNote}
          </p>
        </section>

        <section
          aria-labelledby="analytics-wall"
          className={`${PANEL} motion-safe:animate-fade-in-up motion-safe:opacity-0 lg:col-span-8 lg:col-start-1 lg:row-start-3`}
          style={{ animationDelay: "0.1s" }}
        >
          <header className={PANEL_HEAD}>
            <h2 className={PANEL_TITLE} id="analytics-wall">
              Season wall
            </h2>
            <span className={META}>tap a month to unfold its photos</span>
          </header>

          {years.map((year) => {
            const yearMonths = stats.months.filter((month) =>
              month.key.startsWith(`${year}-`),
            );
            const yearWorks = yearMonths.reduce(
              (sum, month) => sum + month.count,
              0,
            );
            const yearActive = yearMonths.filter((month) => month.count > 0).length;
            return (
              <div key={year} className="mb-6 last:mb-0">
                <div className="mb-3 flex items-baseline gap-3 border-b-2 border-[var(--border)] pb-1">
                  <span className="font-display text-3xl leading-none">{year}</span>
                  <span className={META}>
                    {yearWorks} works · {yearActive} active months
                  </span>
                </div>
                <div className="grid gap-2.5 md:grid-cols-4">
                  {[0, 1, 2, 3].map((quarter) => (
                    <div
                      key={quarter}
                      className="border-2 border-dashed border-[var(--border)] p-2.5 max-md:border-0 max-md:p-0"
                    >
                      <span className={`${META} mb-2 block max-md:hidden`}>
                        Q{quarter + 1}
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map((offset) => {
                          const monthNumber = quarter * 3 + offset + 1;
                          const key = `${year}-${String(monthNumber).padStart(2, "0")}`;
                          const month = monthsByKey.get(key);
                          const count = month?.count ?? 0;
                          const isSelected = key === unfoldMonth?.key;
                          return (
                            <button
                              key={key}
                              aria-pressed={isSelected}
                              className={`flex cursor-pointer flex-col gap-0.5 border-2 border-[var(--border)] px-1.5 py-1.5 text-left transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-brutal-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)] focus-visible:ring-offset-2 motion-reduce:transition-none ${
                                isSelected
                                  ? "outline-[3px] outline-offset-2 outline-[var(--text-primary)]"
                                  : ""
                              } ${monthLevelClass(count)}`}
                              title={`${formatMonthYear(key)}: ${count} works`}
                              type="button"
                              onClick={() => setSelectedMonth(key)}
                            >
                              <span className="font-mono text-[0.54rem] uppercase tracking-wider">
                                {formatMonth(key)}
                              </span>
                              <span className="font-display text-xl leading-none">
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {unfoldMonth ? (
            <div
              aria-live="polite"
              className="mt-1 border-2 border-[var(--border)] bg-[var(--background)] p-3"
            >
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-2xl leading-none">
                  {unfoldMonth.count} works
                </span>
                <span className={META}>{formatMonthYear(unfoldMonth.key)}</span>
                <span className={META}>
                  {unfoldMonth.covers.length > 0
                    ? `showing ${unfoldMonth.covers.length} of ${unfoldMonth.count}`
                    : "nothing made this month"}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5">
                {unfoldMonth.covers.map((storagePath) => (
                  <Image
                    key={storagePath}
                    alt=""
                    className="size-[72px] flex-none border-2 border-[var(--border)] object-cover shadow-[var(--shadow-brutal-sm)]"
                    height={72}
                    quality={70}
                    sizes="72px"
                    src={getPublicImageUrl(storagePath)}
                    width={72}
                  />
                ))}
                {unfoldMonth.count > unfoldMonth.covers.length ? (
                  <span className="grid size-[72px] flex-none place-items-center border-2 border-[var(--border)] bg-[var(--accent)] font-display text-base text-black">
                    +{unfoldMonth.count - unfoldMonth.covers.length}
                  </span>
                ) : null}
              </div>
              {unfoldMonth.count > 0 ? (
                // Plain anchor, not <Link>: the gallery keeps its filters in
                // client state, so a soft navigation to "/" would not adopt the
                // linked range. A document load remounts it with them.
                <a
                  className={`mt-3 ${GHOST_LINK}`}
                  href={hrefForRange(monthRange(unfoldMonth.key))}
                >
                  See these in the grid →
                </a>
              ) : null}
            </div>
          ) : null}

          <p className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[0.6rem] uppercase tracking-wider text-[var(--text-secondary)]">
            <span>
              <i className="mr-1.5 inline-block size-3 border-2 border-dashed border-[var(--border)] align-[-3px]" />
              none
            </span>
            <span>
              <i className="mr-1.5 inline-block size-3 border-2 border-[var(--border)] bg-[var(--accent)] align-[-3px]" />
              1–4
            </span>
            <span>
              <i className="mr-1.5 inline-block size-3 border-2 border-[var(--border)] bg-[var(--secondary)] align-[-3px]" />
              5–9
            </span>
            <span>
              <i className="mr-1.5 inline-block size-3 border-2 border-[var(--border)] bg-[var(--primary)] align-[-3px]" />
              10+
            </span>
          </p>
        </section>

        <section
          aria-labelledby="analytics-tags"
          className={`${PANEL} motion-safe:animate-fade-in-up motion-safe:opacity-0 lg:col-span-12 lg:row-start-4`}
          style={{ animationDelay: "0.15s" }}
        >
          <header className={PANEL_HEAD}>
            <h2 className={PANEL_TITLE} id="analytics-tags">
              Tags
            </h2>
            <span className={META}>
              {stats.tagsInUse} in use · {stats.tagsPerWork} per work
            </span>
          </header>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <div
              aria-label={`Tags by number of works: ${stats.tags
                .map((tag) => `${tag.name} ${tag.count}`)
                .join(", ")}.`}
              className="dot-grid relative hidden h-[236px] border-2 border-dashed border-[var(--border)] lg:block"
              role="img"
            >
              {stats.tags.map((tag, index) => {
                const size = Math.round(44 + Math.sqrt(tag.count) * 8.6);
                const position = BLOB_POSITIONS[index % BLOB_POSITIONS.length];
                return (
                  <div
                    key={tag.name}
                    className={`absolute grid place-items-center rounded-full border-[3px] border-[var(--border)] shadow-[var(--shadow-brutal-sm)] motion-safe:animate-float ${
                      BLOB_TONES[index % BLOB_TONES.length]
                    }`}
                    style={{
                      animationDelay: `${index * 0.6}s`,
                      height: size,
                      left: `${position.left}%`,
                      top: `${position.top}%`,
                      width: size,
                    }}
                    title={`${tag.name}: ${tag.count} works`}
                  >
                    <span
                      className="font-display leading-none"
                      style={{ fontSize: Math.round(size / 4.4) }}
                    >
                      {tag.count}
                    </span>
                    <span className="text-[0.58rem] font-bold tracking-wide">
                      {tag.name}
                    </span>
                  </div>
                );
              })}
            </div>

            <ul className="lg:hidden">
              {stats.tags.map((tag) => (
                <li
                  key={tag.name}
                  className="mb-2.5 flex items-baseline gap-3 border-2 border-[var(--border)] bg-[var(--background)] px-3 py-2 shadow-[var(--shadow-brutal-sm)]"
                >
                  <span className="min-w-[2.6em] font-display text-2xl leading-none tabular-nums">
                    {tag.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{tag.name}</span>
                    <span className="float-right font-mono text-[0.66rem]">
                      {Math.round((tag.count / stats.works) * 100)}%
                    </span>
                    <span className="mt-1.5 block h-2 border-2 border-[var(--border)] bg-[var(--surface)]">
                      <span
                        className="block h-full bg-[var(--secondary)]"
                        style={{
                          width: `${Math.round((tag.count / stats.works) * 100)}%`,
                        }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <ul className={`${FACTS} hidden lg:block`}>
              {stats.tags.map((tag) => (
                <li className={FACT_ROW} key={tag.name}>
                  <span className="text-[var(--text-secondary)]">{tag.name}</span>
                  <span className="text-right font-bold">
                    {tag.count} works · {Math.round((tag.count / stats.works) * 100)}%
                    {tag.firstMonth === tag.lastMonth
                      ? ` · ${formatMonthYear(tag.firstMonth)} only`
                      : ` · ${formatMonthYear(tag.lastMonth)}`}
                  </span>
                </li>
              ))}
              <li className={FACT_ROW}>
                <span className="text-[var(--text-secondary)]">Untagged works</span>
                <span className="text-right font-bold">
                  {stats.untaggedWorks === 0 ? "none" : stats.untaggedWorks}
                </span>
              </li>
              <li className={FACT_ROW}>
                <span className="text-[var(--text-secondary)]">Tag links</span>
                <span className="text-right font-bold">{tagTotal}</span>
              </li>
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="analytics-rhythm"
          className={`${PANEL} motion-safe:animate-fade-in-up motion-safe:opacity-0 lg:col-span-4 lg:col-start-9 lg:row-start-2`}
          style={{ animationDelay: "0.2s" }}
        >
          <header className={PANEL_HEAD}>
            <h2 className={PANEL_TITLE} id="analytics-rhythm">
              Rhythm
            </h2>
            <span className={META}>
              {years.at(0)} → {years.at(-1)}
            </span>
          </header>

          <div className="grid grid-cols-[auto_repeat(12,minmax(0,1fr))] items-center gap-1">
            <span />
            {MONTH_INITIALS.map((initial, index) => (
              <span
                className="text-center font-mono text-[0.5rem] uppercase text-[var(--text-secondary)]"
                key={`${initial}-${index}`}
              >
                {initial}
              </span>
            ))}
            {years.map((year) => (
              <Fragment key={year}>
                <span className="pr-1 font-mono text-[0.55rem] text-[var(--text-secondary)]">
                  {year}
                </span>
                {MONTH_INITIALS.map((_, index) => {
                  const key = `${year}-${String(index + 1).padStart(2, "0")}`;
                  const count = monthsByKey.get(key)?.count ?? 0;
                  const isFuture = key > lastMonthKey;
                  return (
                    <span
                      key={key}
                      className={`grid aspect-square min-w-0 place-items-center border-2 border-[var(--border)] font-mono text-[0.46rem] tabular-nums ${
                        count === maxCount && count > 0
                          ? "bg-[var(--primary)] text-black"
                          : count > 0
                            ? "bg-[var(--secondary)] text-black"
                            : isFuture
                              ? "border-dotted bg-transparent text-[var(--text-secondary)] opacity-50"
                              : "border-dashed bg-transparent text-[var(--text-secondary)]"
                      }`}
                      title={`${formatMonthYear(key)}: ${count} works`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </div>

          <p className="mt-2 text-[0.82rem]">
            {stats.activeMonths} of {stats.months.length} months produced something.
            Longest run: <b className="font-mono">{stats.longestActiveStreak}</b> in a
            row.
          </p>

          <ul className={FACTS}>
            <li className={FACT_ROW}>
              <span className="text-[var(--text-secondary)]">
                Longest quiet stretch
              </span>
              <span className="text-right font-bold">
                {stats.longestQuietStretch
                  ? `${formatMonthYear(stats.longestQuietStretch.from)} → ${formatMonthYear(stats.longestQuietStretch.to)} · ${stats.longestQuietStretch.months} months`
                  : "none"}
              </span>
            </li>
            <li className={FACT_ROW}>
              <span className="text-[var(--text-secondary)]">Quiet stretches</span>
              <span className="text-right font-bold">{stats.quietStretches}</span>
            </li>
            <li className={FACT_ROW}>
              <span className="text-[var(--text-secondary)]">Busiest day</span>
              <span className="text-right font-bold">
                {busiest ? `${formatDay(busiest.date)} · ${busiest.count}` : "—"}
              </span>
            </li>
            <li className={FACT_ROW}>
              <span className="text-[var(--text-secondary)]">
                Pace{stats.latestYear ? `, ${stats.latestYear.year}` : ""}
              </span>
              <span className="text-right font-bold">
                {stats.latestYear
                  ? `${stats.latestYear.perMonth} works / month`
                  : "—"}
              </span>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="analytics-weekday"
          className={`${PANEL} motion-safe:animate-fade-in-up motion-safe:opacity-0 lg:col-span-4 lg:col-start-9 lg:row-start-3`}
          style={{ animationDelay: "0.25s" }}
        >
          <header className={PANEL_HEAD}>
            <h2 className={PANEL_TITLE} id="analytics-weekday">
              Weekday
            </h2>
            <span className={META}>works dated</span>
          </header>
          <div
            aria-label={`Works by weekday: ${WEEKDAY_LABELS.map(
              (label, index) => `${label} ${stats.weekday[index]}`,
            ).join(", ")}.`}
            className="flex h-[118px] items-end gap-1.5"
            role="img"
          >
            {stats.weekday.map((count, index) => (
              <div
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                key={WEEKDAY_LABELS[index]}
                title={`${WEEKDAY_LABELS[index]}: ${count} works`}
              >
                <span className="font-mono text-[0.62rem]">{count}</span>
                <div
                  className={`w-full border-2 border-[var(--border)] ${
                    count === weekdayMax
                      ? "bg-[var(--primary)]"
                      : "bg-[var(--secondary)]"
                  }`}
                  style={{ height: percent(count, weekdayMax) }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <span
                className="flex-1 text-center font-mono text-[0.56rem] uppercase text-[var(--text-secondary)]"
                key={label}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[0.82rem] text-[var(--text-secondary)]">
            {WEEKDAY_LABELS[stats.weekday.indexOf(weekdayMax)]} is the studio day —{" "}
            {weekdayMax} works.
          </p>
        </section>

        <section
          aria-labelledby="analytics-day"
          className={`${PANEL} motion-safe:animate-fade-in-up motion-safe:opacity-0 lg:col-span-12 lg:row-start-5`}
          style={{ animationDelay: "0.3s" }}
        >
          <header className={PANEL_HEAD}>
            <h2 className={PANEL_TITLE} id="analytics-day">
              Busiest day
            </h2>
            <span className={META}>by works dated</span>
          </header>
          {busiest ? (
            <>
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-3xl leading-none">
                  {busiest.count}
                </span>
                <span className="text-[0.9rem] font-bold uppercase tracking-wide">
                  works on {formatDay(busiest.date)}
                </span>
                {stats.runnerUpDay ? (
                  <span className={META}>
                    next: {formatDay(stats.runnerUpDay.date)} ·{" "}
                    {stats.runnerUpDay.count} works
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5">
                {busiest.covers.map((storagePath) => (
                  <Image
                    key={storagePath}
                    alt=""
                    className="size-[72px] flex-none border-2 border-[var(--border)] object-cover shadow-[var(--shadow-brutal-sm)]"
                    height={72}
                    quality={70}
                    sizes="72px"
                    src={getPublicImageUrl(storagePath)}
                    width={72}
                  />
                ))}
              </div>
              <a
                className={`mt-3 ${GHOST_LINK}`}
                href={hrefForRange({ from: busiest.date, to: busiest.date })}
              >
                See that day in the grid →
              </a>
            </>
          ) : null}
        </section>
      </div>

      <div
        aria-hidden="true"
        className="hidden overflow-hidden border-y-4 border-[var(--border)] bg-[var(--accent)] text-black lg:block"
      >
        <div className="flex gap-8 whitespace-nowrap py-2.5 font-display text-base uppercase tracking-wide motion-safe:animate-marquee">
          {[0, 1].map((copy) => (
            <span className="flex gap-8" key={copy}>
              {stats.tags.map((tag) => (
                <span key={tag.name}>
                  {tag.name} ×{tag.count}
                </span>
              ))}
              <span>{stats.photos} photographs</span>
              <span>{stats.activeMonths} active months</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
