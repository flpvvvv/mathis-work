import { WorkCard } from "@/components/gallery/work-card";
import type { Work } from "@/lib/types";

function toMonthKey(date: string) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

type Props = {
  works: Work[];
  backHref: string;
};

export function TimelineView({ works, backHref }: Props) {
  const grouped = works.reduce<Record<string, Work[]>>((acc, work) => {
    const key = toMonthKey(work.created_date);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(work);
    return acc;
  }, {});

  const monthKeys = Object.keys(grouped).toSorted((a, b) => b.localeCompare(a));

  if (monthKeys.length === 0) {
    return (
      <div className="rounded-none border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-secondary)]">
        No works found for these filters.
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {monthKeys.map((monthKey, monthIndex) => (
        <section 
          key={monthKey} 
          className="space-y-4 motion-safe:animate-fade-in-up motion-safe:opacity-0 border-l-4 border-black dark:border-white pl-4 ml-2"
          style={{ animationDelay: `${Math.min(monthIndex * 0.1, 1)}s` }}
        >
          <h2 className="text-2xl font-bold font-display bg-[var(--accent)] inline-block px-3 py-1 border-2 border-black shadow-[var(--shadow-brutal-sm)] dark:text-black">
            {toLabel(grouped[monthKey][0].created_date)}
          </h2>
          <div className="flex snap-x gap-6 overflow-x-auto pb-6 pt-2 pl-2">
            {grouped[monthKey].map((work) => (
              <div key={work.id} className="min-w-[280px] max-w-[280px] flex-none snap-start">
                <WorkCard backHref={backHref} work={work} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
