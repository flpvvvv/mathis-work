import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border-2 border-[var(--border)] bg-[var(--secondary)] text-black shadow-[var(--shadow-brutal-sm)] px-2 py-0.5 text-xs font-bold uppercase tracking-wider font-display",
        className,
      )}
      {...props}
    />
  );
}
