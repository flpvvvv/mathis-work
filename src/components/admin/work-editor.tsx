"use client";

import type { FormEvent } from "react";
import { Check, Trash2, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { EditableImage, SaveWorkPayload } from "@/lib/admin/work-payload";
import { resolveCoverImageId } from "@/lib/admin/work-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reencodeToJpeg } from "@/lib/image/jpeg";
import { BUCKET_NAME, getStoragePath } from "@/lib/storage/images";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Work } from "@/lib/types";

type Props = {
  mode: "create" | "edit";
  work?: Work;
};

type PendingUpload = {
  id: string;
  file: File;
  state: "pending" | "processing" | "ready" | "error";
  mode?: "as-is" | "corrected";
  result?: {
    blob: Blob;
    width: number;
    height: number;
  };
  error?: string;
};

const PerspectiveCorrector = dynamic(
  () =>
    import("@/components/admin/perspective-corrector").then(
      (mod) => mod.PerspectiveCorrector,
    ),
  { ssr: false },
);

export function WorkEditor({ mode, work }: Props) {
  const router = useRouter();
  const [description, setDescription] = useState(work?.description ?? "");
  const [createdDate, setCreatedDate] = useState(
    work?.created_date ?? new Date().toISOString().slice(0, 10),
  );
  const [tags, setTags] = useState(work?.tags.map((tag) => tag.name).join(", ") ?? "");
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
  const [correctingUploadId, setCorrectingUploadId] = useState<string | null>(null);

  const heading = useMemo(
    () => (mode === "create" ? "Save New Work" : "Update Work"),
    [mode],
  );
  const activeCorrection = uploads.find((upload) => upload.id === correctingUploadId);
  const readyUploads = uploads.filter(
    (upload): upload is PendingUpload & { result: NonNullable<PendingUpload["result"]> } =>
      upload.state === "ready" && Boolean(upload.result),
  );
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
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
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
    if (!window.confirm("Delete this work permanently?")) {
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
        <div className="grid gap-4 md:grid-cols-2">
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
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              name="tags"
              autoComplete="off"
              placeholder="portrait, watercolor"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Describe this artwork..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="images">Images</Label>
          <div className="space-y-2 rounded-none border border-[var(--border)] p-3">
            {images.length === 0 && uploads.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No images selected yet.</p>
            ) : (
              <div className="space-y-3">
                {uploads.some((upload) => upload.state === "pending") && (
                  <div className="flex justify-end mb-2">
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
                {images
                  .toSorted((a, b) => a.displayOrder - b.displayOrder)
                  .map((image) => (
                    <div
                      key={image.id}
                      className="flex items-center justify-between gap-3 rounded-none border border-[var(--border)] p-2"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-medium">{image.storagePath}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {image.width}x{image.height}px
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            checked={coverImageId === image.id}
                            name="cover-image"
                            type="radio"
                            onChange={() => setCoverImageId(image.id)}
                          />
                          Cover
                        </label>
                        <button
                          aria-label="Remove image"
                          className="inline-flex size-8 items-center justify-center rounded-none border border-[var(--border)]"
                          type="button"
                          onClick={() => removeImage(image.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center justify-between gap-3 rounded-none border border-[var(--border)] p-2"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{upload.file.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {upload.state === "ready" && upload.result
                          ? `${upload.result.width}x${upload.result.height}px • ${upload.mode}`
                          : upload.state}
                      </p>
                      {upload.error ? (
                        <p className="text-xs text-red-700">{upload.error}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
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
                            onClick={() => setCorrectingUploadId(upload.id)}
                          >
                            Correct Perspective
                          </Button>
                        </>
                      ) : null}
                      {upload.state === "ready" ? (
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            checked={coverImageId === upload.id}
                            name="cover-image"
                            type="radio"
                            onChange={() => setCoverImageId(upload.id)}
                          />
                          Cover
                        </label>
                      ) : null}
                      <button
                        aria-label="Remove upload"
                        className="inline-flex size-8 items-center justify-center rounded-none border border-[var(--border)]"
                        type="button"
                        onClick={() => removeUpload(upload.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Input
            id="images"
            multiple
            accept="image/*"
            type="file"
            onChange={(event) => onFilesSelected(event.target.files)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} type="submit">
            <Upload className="mr-2 size-4" />
            {heading}
          </Button>

          {mode === "edit" ? (
            <Button
              disabled={deleting}
              type="button"
              variant="destructive"
              onClick={onDelete}
            >
              Delete Work
            </Button>
          ) : null}
        </div>

        {mode === "create" ? (
          <p className="text-xs text-[var(--text-secondary)]">
            You can create a work without images and add images later.
          </p>
        ) : null}
      </form>

      {activeCorrection ? (
        <div className="mt-4">
          <PerspectiveCorrector
            file={activeCorrection.file}
            onApply={(result) => {
              setUploads((current) =>
                current.map((upload) =>
                  upload.id === activeCorrection.id
                    ? {
                        ...upload,
                        state: "ready",
                        mode: "corrected",
                        result,
                        error: undefined,
                      }
                    : upload,
                ),
              );
              if (!coverImageId) {
                setCoverImageId(activeCorrection.id);
              }
              setCorrectingUploadId(null);
            }}
            onCancel={() => {
              setCorrectingUploadId(null);
              void processAsIs(activeCorrection.id);
            }}
          />
        </div>
      ) : null}
    </Card>
  );
}
