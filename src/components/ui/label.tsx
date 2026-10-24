import type { LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers associate this primitive via htmlFor
    <label
      className={cn("text-sm font-medium text-[var(--text-primary)]", className)}
      {...props}
    />
  );
}
