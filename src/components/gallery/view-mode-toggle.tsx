"use client";

import { LayoutGrid, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ViewMode = "grid" | "timeline";

type Props = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export function ViewModeToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex rounded-none border border-[var(--border)] bg-[var(--surface)] p-1">
      <Button
        className="h-8 px-3"
        size="sm"
        type="button"
        variant={mode === "grid" ? "default" : "ghost"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="mr-1 size-4" />
        Grid
      </Button>
      <Button
        className="h-8 px-3"
        size="sm"
        type="button"
        variant={mode === "timeline" ? "default" : "ghost"}
        onClick={() => onChange("timeline")}
      >
        <ListOrdered className="mr-1 size-4" />
        Timeline
      </Button>
    </div>
  );
}
