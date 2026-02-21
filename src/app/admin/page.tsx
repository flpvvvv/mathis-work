import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getWorksPage } from "@/lib/data/works";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(date));
}

export default async function AdminDashboardPage() {
  const works = await getWorksPage({ page: 1, pageSize: 100 });

  return (
    <section className="space-y-3">
      {works.items.length === 0 ? (
        <Card className="p-8 text-center text-[var(--text-secondary)]">
          No works yet. Create your first one.
        </Card>
      ) : (
        works.items.map((work) => (
          <Card key={work.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{work.description ?? "Untitled work"}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {formatDate(work.created_date)}
              </p>
            </div>
            <Link
              className="inline-flex h-9 items-center rounded-none border border-[var(--border)] px-3 text-sm"
              href={`/admin/works/${work.id}/edit`}
            >
              Edit
            </Link>
          </Card>
        ))
      )}
    </section>
  );
}
