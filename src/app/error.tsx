"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        Could not save or load this data. Please check your connection and try again.
      </p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
