"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getPublicImageUrl } from "@/lib/storage/images";
import type { WorkImage } from "@/lib/types";

type Props = {
  images: WorkImage[];
  initialImageId?: string | null;
  altText: string;
};

export function WorkGallery({ images, initialImageId, altText }: Props) {
  const initialIndex = useMemo(() => {
    if (!initialImageId) return 0;
    const index = images.findIndex((image) => image.id === initialImageId);
    return index === -1 ? 0 : index;
  }, [images, initialImageId]);
  const [index, setIndex] = useState(initialIndex);

  const current = images[index];
  const hasMultiple = images.length > 1;

  if (!current) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-none border border-dashed border-[var(--border)] text-sm text-[var(--text-secondary)]">
        No images for this work.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-none border border-[var(--border)] bg-black/5 dark:bg-white/5">
        <Image
          fill
          priority
          alt={altText}
          className="object-contain"
          quality={70}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 60vw"
          src={getPublicImageUrl(current.storage_path)}
        />

        {hasMultiple ? (
          <>
            <Button
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => setIndex((prev) => (prev - 1 + images.length) % images.length)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => setIndex((prev) => (prev + 1) % images.length)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        ) : null}
      </div>

      {hasMultiple ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              aria-label={`View image ${imageIndex + 1}`}
              className={`relative size-16 shrink-0 overflow-hidden rounded-none border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--border)] ${
                imageIndex === index
                  ? "border-[var(--primary)]"
                  : "border-[var(--border)] opacity-80"
              }`}
              type="button"
              onClick={() => setIndex(imageIndex)}
            >
              <Image
                fill
                alt=""
                className="object-cover"
                sizes="64px"
                src={getPublicImageUrl(image.storage_path)}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
