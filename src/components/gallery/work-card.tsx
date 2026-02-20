import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getPublicImageUrl } from "@/lib/storage/images";
import type { Work } from "@/lib/types";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

type Props = {
  work: Work;
  backHref: string;
};

export function WorkCard({ work, backHref }: Props) {
  const coverImage =
    work.images.find((image) => image.id === work.cover_image_id) ?? work.images[0];
  const thumbnail = coverImage
    ? getPublicImageUrl(coverImage.storage_path, { width: 600, resize: "contain" })
    : null;

  return (
    <Link
      href={{
        pathname: `/works/${work.id}`,
        query: {
          back: backHref,
        },
      }}
      className="group block overflow-hidden border-2 border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-brutal)] transition-all hover:-translate-y-1 hover:translate-x-1 hover:rotate-1 hover:shadow-[var(--shadow-brutal-lg)]"
    >
      <div className="relative aspect-[3/4] w-full border-b-2 border-[var(--border)] bg-[#FFE66D]/20 dark:bg-white/5">
        {thumbnail ? (
          <Image
            fill
            alt={work.description ?? "Artwork by Mathis"}
            className="object-contain"
            loading="lazy"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 20vw"
            src={thumbnail}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-secondary)]">
            No image
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs text-[var(--text-secondary)]">
          {formatDate(work.created_date)}
        </p>
        <p className="line-clamp-2 text-sm">{work.description ?? "Untitled work"}</p>
        <div className="flex flex-wrap gap-1">
          {work.tags.slice(0, 2).map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
          {work.tags.length > 2 ? <Badge>+{work.tags.length - 2}</Badge> : null}
        </div>
      </div>
    </Link>
  );
}
