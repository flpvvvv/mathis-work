"use client";

import type { FormEvent, ReactNode } from "react";
import { Check, Star, Trash2, Upload, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TagInput } from "@/components/admin/tag-input";
import type { EditableImage, SaveWorkPayload } from "@/lib/admin/work-payload";
import { resolveCoverImageId } from "@/lib/admin/work-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reencodeToJpeg } from "@/lib/image/jpeg";
import { createThumbnailUrl } from "@/lib/image/thumbnail";
import {
  BUCKET_NAME,
  getPublicImageUrl,
  getStoragePath,
} from "@/lib/storage/images";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Work } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  mode: "create" | "edit";
  work?: Work;
  /** All existing tags available for selection */
  availableTags?: string[];
};

type PendingUpload = {
  id: string;
  file: File;
  state: "pending" | "processing" | "ready" | "error";
  mode?: "as-is" | "modified";
  result?: {
    blob: Blob;
    width: number;
    height: number;
  };
  error?: string;
};

const ImageModifier = dynamic(
  () =>
    import("@/components/admin/image-modifier").then(
      (mod) => mod.ImageModifier,
    ),
  { ssr: false },
);

const THUMBNAIL_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

type ReadyUpload = PendingUpload & {
  mode: "as-is" | "modified";
  result: NonNullable<PendingUpload["result"]>;
};

function isReadyUpload(upload: PendingUpload): upload is ReadyUpload {
  return upload.state === "ready" && Boolean(upload.result && upload.mode);
}

function uploadSubtitle(upload: PendingUpload) {
  if (isReadyUpload(upload)) {
    return `${upload.result.width}×${upload.result.height}px • ${
      upload.mode === "modified" ? "modified" : "as-is"
    }`;
  }
  if (upload.state === "processing") {
    return "Processing…";
  }
  if (upload.state === "error") {
    return "Processing failed";
  }
  return "Not processed yet";
}

/** Local preview for an image that is not in storage yet. */
function BlobThumbnail({ alt, blob }: { alt: string; blob: Blob }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createThumbnailUrl(blob)
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (!previewUrl) {
    return null;
  }

  return (
    <Image
      unoptimized
      alt={alt}
      className="object-contain"
      fill
      sizes={THUMBNAIL_SIZES}
      src={previewUrl}
    />
  );
}

type MediaCardProps = {
  alt: string;
  title: string;
  subtitle: string;
  /** Public URL of an image that is already in storage */
  src?: string;
  /** Local blob of an image that is not uploaded yet */
  blob?: Blob;
  /** Null while the image cannot be used as cover yet */
  cover: { selected: boolean } | null;
  onSelectCover: () => void;
  actions: ReactNode;
  error?: string;
};

function MediaCard({
  actions,
  alt,
  blob,
  cover,
  error,
  onSelectCover,
  src,
  subtitle,
  title,
}: MediaCardProps) {
  const thumbnail = (
    <>
      {src ? (
        <Image
          alt={alt}
          className="object-contain"
          fill
          sizes={THUMBNAIL_SIZES}
          src={src}
        />
      ) : null}
      {blob ? <BlobThumbnail alt={alt} blob={blob} /> : null}
      {cover?.selected ? (
        <span className="absolute top-1 left-1 inline-flex items-center gap-1 border-2 border-[var(--border)] bg-[var(--accent)] px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-[2px_2px_0_var(--border)]">
          <Star className="size-3" />
          Cover
        </span>
      ) : null}
    </>
  );

  return (
    <li
      className={cn(
        "flex flex-col border-2 border-[var(--border)] bg-[var(--surface)]",
        cover?.selected && "shadow-[var(--shadow-brutal-sm)]",
      )}
    >
      {cover ? (
        <label
          className="relative block aspect-[4/3] w-full cursor-pointer overflow-hidden border-b-2 border-[var(--border)] bg-black/5 focus-within:ring-2 focus-within:ring-[var(--border)] focus-within:ring-offset-2 focus-within:ring-offset-transparent dark:bg-white/5"
          title={`Use ${title} as cover`}
        >
          <input
            aria-label={`Use ${title} as cover`}
            checked={cover.selected}
            className="sr-only"
            name="cover-image"
            type="radio"
            onChange={onSelectCover}
          />
          {thumbnail}
        </label>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b-2 border-[var(--border)] bg-black/5 dark:bg-white/5">
          {thumbnail}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" title={title}>
            {title}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>
          {error ? (
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      </div>
    </li>
  );
}

export function WorkEditor({ mode, work, availableTags = [] }: Props) {
  const router = useRouter();
  const [description, setDescription] = useState(work?.description ?? "");
  const [createdDate, setCreatedDate] = useState(
    work?.created_date ?? new Date().toISOString().slice(0, 10),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    work?.tags.map((tag) => tag.name.toLowerCase()) ?? [],
  );
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [images, setImages] = useState<EditableImage[]>(
    (work?.images ?? []).map((image) => ({
      id: image.id,
      storagePath: image.storage_path,
      width: image.width,
      height: image.height,
      displayOrder: image.display_order,
    })),
  );
  const [coverImageId, setCoverImageId] = useState<string | null>(
    work?.cover_image_id ?? work?.images[0]?.id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const [modifyingUploadId, setModifyingUploadId] = useState<string | null>(null);

  useEffect(() => {
    if (confirmDelete) {
      deleteConfirmRef.current?.focus();
    }
  }, [confirmDelete]);

  const heading = useMemo(
    () => (mode === "create" ? "Save New Work" : "Update Work"),
    [mode],
  );
  const activeUpload = uploads.find((upload) => upload.id === modifyingUploadId);
  const readyUploads = uploads.filter(isReadyUpload);
  const unresolvedUploads = uploads.filter(
    (upload) =>
      upload.state === "pending" ||
      upload.state === "processing" ||
      upload.state === "error",
  );

  function onFilesSelected(fileList: FileList | null) {
    const picked = Array.from(fileList ?? []);
    const maxFileSize = 20 * 1024 * 1024;

    const validFiles = picked.filter((file) => {
      if (file.size > maxFileSize) {
        toast.error("Image is too large. Please use an image under 20MB.");
        return false;
      }
      return true;
    });

    setUploads((current) => [
      ...current,
      ...validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        state: "pending" as const,
      })),
    ]);
  }

  async function processAsIs(uploadId: string) {
    const target = uploads.find((upload) => upload.id === uploadId);
    if (!target) return;

    setUploads((current) =>
      current.map((upload) =>
        upload.id === uploadId
          ? { ...upload, state: "processing", error: undefined }
          : upload,
      ),
    );

    try {
      const result = await reencodeToJpeg(target.file, 0.8);
      setUploads((current) =>
        current.map((upload) =>
          upload.id === uploadId
            ? {
                ...upload,
                state: "ready",
                mode: "as-is",
                result,
              }
            : upload,
        ),
      );
      if (!coverImageId) {
        setCoverImageId(uploadId);
      }
    } catch {
      setUploads((current) =>
        current.map((upload) =>
          upload.id === uploadId
            ? {
                ...upload,
                state: "error",
                error: "Could not process the image. Please try again or skip correction.",
              }
            : upload,
        ),
      );
    }
  }

  function removeUpload(uploadId: string) {
    setUploads((current) => current.filter((upload) => upload.id !== uploadId));
    if (coverImageId === uploadId) {
      setCoverImageId(resolveCoverImageId(images, null));
    }
  }

  async function uploadPreparedImages(
    workId: string,
    prepared: typeof readyUploads,
    currentImages: EditableImage[],
  ) {
    const supabase = getSupabaseBrowserClient();
    const nextOrderStart =
      currentImages.reduce((max, image) => Math.max(max, image.displayOrder), -1) + 1;

    const uploaded = await Promise.all(
      prepared.map(async (upload, index) => {
        const storagePath = getStoragePath(workId, upload.id);
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, upload.result.blob, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (error) {
          throw new Error("Failed to upload image. Please try again.");
        }

        return {
          id: upload.id,
          storagePath,
          width: upload.result.width,
          height: upload.result.height,
          displayOrder: nextOrderStart + index,
        } satisfies EditableImage;
      }),
    );

    return uploaded;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unresolvedUploads.length > 0) {
      toast.error("Please choose correction or as-is for all selected images.");
      return;
    }

    setSaving(true);
    try {
      const basePayload: SaveWorkPayload = {
        description: description.trim(),
        createdDate,
        tags: selectedTags,
        images,
        coverImageId: resolveCoverImageId(images, coverImageId),
      };

      let workId = work?.id;
      if (!workId) {
        const createResponse = await fetch("/api/admin/works", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(basePayload),
        });
        const createJson = (await createResponse.json()) as {
          id?: string;
          message?: string;
        };
        if (!createResponse.ok || !createJson.id) {
          toast.error(
            createJson.message ??
              "Could not save the work. Please check your connection and try again.",
          );
          return;
        }
        workId = createJson.id;
      }

      const uploadedImages =
        readyUploads.length > 0
          ? await uploadPreparedImages(workId, readyUploads, images)
          : [];
      const finalImages = [...images, ...uploadedImages].map((image, index) => ({
        ...image,
        displayOrder: index,
      }));

      const finalPayload: SaveWorkPayload = {
        ...basePayload,
        images: finalImages,
        coverImageId: resolveCoverImageId(finalImages, coverImageId),
      };

      const updateResponse = await fetch(`/api/admin/works/${workId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalPayload),
      });
      const updateJson = (await updateResponse.json()) as { message?: string };
      if (!updateResponse.ok) {
        toast.error(
          updateJson.message ??
            "Could not save the work. Please check your connection and try again.",
        );
        return;
      }

      toast.success(mode === "create" ? "Work created." : "Work updated.");
      router.push(`/works/${workId}`);
      router.refresh();
    } catch {
      toast.error("Connection lost. Please check your internet and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!work?.id) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/works/${work.id}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        toast.error(
          json.message ??
            "Could not save the work. Please check your connection and try again.",
        );
        return;
      }

      toast.success("Work deleted.");
      router.push("/admin");
      router.refresh();
    } catch {
      toast.error("Connection lost. Please check your internet and try again.");
    } finally {
      setDeleting(false);
    }
  }

  function removeImage(imageId: string) {
    setImages((current) => {
      const next = current
        .filter((image) => image.id !== imageId)
        .map((image, index) => ({ ...image, displayOrder: index }));
      if (coverImageId === imageId) {
        setCoverImageId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  return (
    <Card className="p-4">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="images">Images</Label>
          <div className="space-y-3 rounded-none border border-[var(--border)] p-3">
            {images.length === 0 && uploads.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No images selected yet.</p>
            ) : (
              <>
                {uploads.some((upload) => upload.state === "pending") && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        uploads.forEach((upload) => {
                          if (upload.state === "pending") {
                            void processAsIs(upload.id);
                          }
                        });
                      }}
                    >
                      <Check className="mr-2 size-4" />
                      Process all &quot;As-Is&quot;
                    </Button>
                  </div>
                )}

                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {images
                    .toSorted((a, b) => a.displayOrder - b.displayOrder)
                    .map((image, index) => {
                      const label = `Image ${index + 1}`;

                      return (
                        <MediaCard
                          key={image.id}
                          actions={
                            <Button
                              aria-label={`Remove ${label}`}
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => removeImage(image.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          }
                          alt={label}
                          cover={{ selected: coverImageId === image.id }}
                          onSelectCover={() => setCoverImageId(image.id)}
                          src={getPublicImageUrl(image.storagePath)}
                          subtitle={`${image.width}×${image.height}px`}
                          title={label}
                        />
                      );
                    })}

                  {uploads.map((upload) => (
                    <MediaCard
                      key={upload.id}
                      actions={
                        <>
                          {upload.state === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => void processAsIs(upload.id)}
                              >
                                Use As-Is
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => setModifyingUploadId(upload.id)}
                              >
                                Modify
                              </Button>
                            </>
                          ) : null}
                          <Button
                            aria-label={`Remove ${upload.file.name}`}
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => removeUpload(upload.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      }
                      alt={upload.file.name}
                      blob={isReadyUpload(upload) ? upload.result.blob : upload.file}
                      cover={
                        isReadyUpload(upload)
                          ? { selected: coverImageId === upload.id }
                          : null
                      }
                      error={upload.error}
                      onSelectCover={() => setCoverImageId(upload.id)}
                      subtitle={uploadSubtitle(upload)}
                      title={upload.file.name}
                    />
                  ))}
                </ul>

                {images.length + readyUploads.length > 1 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Click a thumbnail to use that image as the work&apos;s cover.
                  </p>
                ) : null}
              </>
            )}
          </div>
          <Input
            id="images"
            multiple
            accept="image/*"
            type="file"
            className="file:mr-4 file:cursor-pointer file:border-2 file:border-primary file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground file:transition-opacity hover:file:opacity-85"
            onChange={(event) => onFilesSelected(event.target.files)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Describe this artwork…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput
              availableTags={availableTags}
              selectedTags={selectedTags}
              onChange={setSelectedTags}
              placeholder="Add a new tag…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="created-date">Created date</Label>
            <Input
              id="created-date"
              name="created-date"
              required
              type="date"
              value={createdDate}
              onChange={(event) => setCreatedDate(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} type="submit">
            <Upload className="mr-2 size-4" />
            {heading}
          </Button>

          {mode === "edit" && !confirmDelete ? (
            <Button
              disabled={deleting}
              type="button"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete Work
            </Button>
          ) : null}
          {mode === "edit" && confirmDelete ? (
            <div className="flex items-center gap-2 border-2 border-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <AlertTriangle className="size-4 shrink-0 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-400">
                Delete permanently?
              </span>
              <Button
                ref={deleteConfirmRef}
                disabled={deleting}
                size="sm"
                type="button"
                variant="destructive"
                onClick={onDelete}
              >
                Yes, Delete
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : null}
        </div>

        {mode === "create" ? (
          <p className="text-xs text-[var(--text-secondary)]">
            You can create a work without images and add images later.
          </p>
        ) : null}
      </form>

      {activeUpload ? (
        <ImageModifier
          key={activeUpload.id}
          file={activeUpload.file}
          onApply={(result) => {
            setUploads((current) =>
              current.map((upload) =>
                upload.id === activeUpload.id
                  ? {
                      ...upload,
                      state: "ready",
                      mode: "modified",
                      result,
                      error: undefined,
                    }
                  : upload,
              ),
            );
            if (!coverImageId) {
              setCoverImageId(activeUpload.id);
            }
            setModifyingUploadId(null);
          }}
          onUseAsIs={() => {
            setModifyingUploadId(null);
            void processAsIs(activeUpload.id);
          }}
          onClose={() => setModifyingUploadId(null)}
        />
      ) : null}
    </Card>
  );
}
