import Link from "next/link";
import { notFound } from "next/navigation";

import { WorkGallery } from "@/components/work/work-gallery";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile } from "@/lib/auth";
import { getWorkById } from "@/lib/data/works";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
  }).format(new Date(date));
}

export default async function WorkPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [work, profile] = await Promise.all([getWorkById(id), getCurrentProfile()]);
  const backHref = query.back?.startsWith("/") ? query.back : "/";

  if (!work) {
    notFound();
  }

  return (
    <article className="space-y-6">
      <Link
        className="inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-sm"
        href={backHref}
      >
        Back to gallery
      </Link>

      <WorkGallery
        altText={work.description ?? "Artwork by Mathis"}
        images={work.images}
        initialImageId={work.cover_image_id}
      />

      <section className="space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">
          {formatDate(work.created_date)}
        </p>
        <p className="text-base">{work.description ?? "Untitled work"}</p>
        <div className="flex flex-wrap gap-2">
          {work.tags.map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
        </div>
      </section>

      {profile?.is_admin ? (
        <section className="flex gap-2">
          <Link
            className="inline-flex h-10 items-center rounded-md border border-[var(--border)] px-4 text-sm"
            href={`/admin/works/${work.id}/edit`}
          >
            Edit
          </Link>
          <Link
            className="inline-flex h-10 items-center rounded-md border border-red-300 px-4 text-sm text-red-700"
            href={`/admin/works/${work.id}/edit?danger=delete`}
          >
            Delete
          </Link>
        </section>
      ) : null}
    </article>
  );
}
