"use client";

import { CalendarDays, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type GalleryFiltersState = {
  query: string;
  tags: string[];
  from: string;
  to: string;
};

type Props = {
  filters: GalleryFiltersState;
  tags: string[];
  onChange: (next: GalleryFiltersState) => void;
  onClear: () => void;
};

export function GalleryFilters({ filters, tags, onChange, onClear }: Props) {
  const [showDates, setShowDates] = useState(
    Boolean(filters.from || filters.to),
  );

  const hasFilters = useMemo(
    () =>
      Boolean(
        filters.query || filters.tags.length || filters.from || filters.to,
      ),
    [filters],
  );

  function toggleTag(tag: string) {
    onChange({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });
  }

  return (
    <section className="space-y-2">
      {tags.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tags.map((tag) => {
              const active = filters.tags.includes(tag);
              return (
                <button
                  key={tag}
                  aria-pressed={active}
                  className={cn(
                    "shrink-0 border-2 px-3 py-1 text-xs font-bold uppercase tracking-wider font-display cursor-pointer transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--border)]",
                    active
                      ? "border-[var(--border)] bg-[var(--primary)] text-black shadow-[var(--shadow-brutal-sm)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] hover:text-black",
                  )}
                  type="button"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label="Toggle date filter"
              className={cn("h-8 w-8", showDates && "bg-[var(--accent)] text-black")}
              size="icon"
              type="button"
              variant="outline"
              onClick={() => setShowDates((v) => !v)}
            >
              <CalendarDays className="size-4" />
            </Button>
            {hasFilters && (
              <Button
                aria-label="Clear all filters"
                className="h-8 w-8"
                size="icon"
                type="button"
                variant="outline"
                onClick={onClear}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {showDates && (
        <div className="flex gap-2">
          <Input
            aria-label="From date"
            className="h-9 text-sm"
            name="filter-from"
            type="date"
            value={filters.from}
            onChange={(event) =>
              onChange({ ...filters, from: event.target.value })
            }
          />
          <Input
            aria-label="To date"
            className="h-9 text-sm"
            name="filter-to"
            type="date"
            value={filters.to}
            onChange={(event) =>
              onChange({ ...filters, to: event.target.value })
            }
          />
        </div>
      )}
    </section>
  );
}
