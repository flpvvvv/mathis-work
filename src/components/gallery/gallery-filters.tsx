"use client";

import { X } from "lucide-react";
import { useMemo } from "react";

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
  const hasFilters = useMemo(
    () =>
      Boolean(filters.query || filters.tags.length || filters.from || filters.to),
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
    <section className="space-y-3">
      <Input
        aria-label="Search descriptions"
        placeholder="Search descriptions..."
        value={filters.query}
        onChange={(event) => onChange({ ...filters, query: event.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = filters.tags.includes(tag);
          return (
            <button
              key={tag}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                active
                  ? "border-transparent bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)]",
              )}
              type="button"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          aria-label="From date"
          type="date"
          value={filters.from}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
        <Input
          aria-label="To date"
          type="date"
          value={filters.to}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
        <Button
          className="sm:justify-self-end"
          disabled={!hasFilters}
          type="button"
          variant="outline"
          onClick={onClear}
        >
          <X className="mr-1 size-4" />
          Clear filters
        </Button>
      </div>
    </section>
  );
}
