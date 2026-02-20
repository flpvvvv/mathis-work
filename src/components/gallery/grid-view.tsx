import { WorkCard } from "@/components/gallery/work-card";
import type { Work } from "@/lib/types";

type Props = {
  works: Work[];
  backHref: string;
};

export function GridView({ works, backHref }: Props) {
  if (works.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-secondary)]">
        No works found for these filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
      {works.map((work, index) => (
        <div
          key={work.id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${Math.min(index * 0.05, 1)}s`, opacity: 0 }}
        >
          <WorkCard backHref={backHref} work={work} />
        </div>
      ))}
    </div>
  );
}
