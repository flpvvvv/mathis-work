import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WorkGallery } from "@/components/work/work-gallery";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile } from "@/lib/auth";
import { getWorkById } from "@/lib/data/works";
import { getPublicImageUrl } from "@/lib/storage/images";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
  }).format(new Date(date));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const work = await getWorkById(id);
  if (!work) return {};

  const label = work.description ?? "Untitled work";
  const dateStr = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
    new Date(work.created_date),
  );
  const tagNames = work.tags.map((t) => t.name).join(", ");

  const title = `${label} — Artwork by Mathis`;
  let description = `Original artwork by Mathis, created ${dateStr}.`;
  if (tagNames) description += ` Tagged: ${tagNames}.`;
  description += ` View the full-resolution image and explore more works in the Mathis Gallery.`;
  if (description.length > 160) description = description.slice(0, 157) + "…";

  const coverImage =
    work.images.find((img) => img.id === work.cover_image_id) ?? work.images[0];
  const ogImages = coverImage
    ? [
        {
          url: getPublicImageUrl(coverImage.storage_path),
          width: coverImage.width,
          height: coverImage.height,
          alt: label,
        },
      ]
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: ogImages,
      publishedTime: work.created_date,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages?.map((img) => img.url),
    },
    alternates: {
      canonical: `/works/${id}`,
    },
  };
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
        className="inline-flex h-9 items-center rounded-none border border-[var(--border)] px-3 text-sm"
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
        <h1 className="text-2xl font-bold font-display">
          {work.description ?? "Untitled work"}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {formatDate(work.created_date)}
        </p>
        <div className="flex flex-wrap gap-2">
          {work.tags.map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
        </div>
      </section>

      {profile?.is_admin ? (
        <section className="flex gap-2">
          <Link
            className="inline-flex h-10 items-center rounded-none border border-[var(--border)] px-4 text-sm"
            href={`/admin/works/${work.id}/edit`}
          >
            Edit
          </Link>
          <Link
            className="inline-flex h-10 items-center rounded-none border border-red-300 px-4 text-sm text-red-700"
            href={`/admin/works/${work.id}/edit?danger=delete`}
          >
            Delete
          </Link>
        </section>
      ) : null}
    </article>
  );
}
