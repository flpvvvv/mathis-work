"use client";

import { BarChart3, LayoutGrid, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ViewMode = "grid" | "timeline" | "analytics";

type Props = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export function ViewModeToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex max-w-full rounded-none border border-[var(--border)] bg-[var(--surface)] p-1">
      <Button
        aria-label="Grid"
        aria-pressed={mode === "grid"}
        className="h-8 px-2.5 sm:px-3"
        size="sm"
        type="button"
        variant={mode === "grid" ? "default" : "ghost"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="mr-1 size-4" />
        {/* Labels appear from 640px; the accessible name comes from aria-label. */}
        <span className="hidden sm:inline">Grid</span>
      </Button>
      <Button
        aria-label="Timeline"
        aria-pressed={mode === "timeline"}
        className="h-8 px-2.5 sm:px-3"
        size="sm"
        type="button"
        variant={mode === "timeline" ? "default" : "ghost"}
        onClick={() => onChange("timeline")}
      >
        <ListOrdered className="mr-1 size-4" />
        <span className="hidden sm:inline">Timeline</span>
      </Button>
      <Button
        aria-label="Analytics"
        aria-pressed={mode === "analytics"}
        className="h-8 px-2.5 sm:px-3"
        size="sm"
        type="button"
        variant={mode === "analytics" ? "default" : "ghost"}
        onClick={() => onChange("analytics")}
      >
        <BarChart3 className="mr-1 size-4" />
        <span className="hidden sm:inline">Analytics</span>
      </Button>
    </div>
  );
}
