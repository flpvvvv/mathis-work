"use client";

import { LayoutGrid, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "timeline";

type Props = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export function ViewModeToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
      <Button
        className={cn("h-8 px-3", mode === "grid" ? "" : "shadow-none")}
        size="sm"
        type="button"
        variant={mode === "grid" ? "default" : "ghost"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="mr-1 size-4" />
        Grid
      </Button>
      <Button
        className={cn("h-8 px-3", mode === "timeline" ? "" : "shadow-none")}
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
