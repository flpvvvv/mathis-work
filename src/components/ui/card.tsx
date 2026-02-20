import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-2 border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-brutal)]",
        className,
      )}
      {...props}
    />
  );
}
