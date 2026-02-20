import { BUCKET_NAME } from "@/lib/storage/images";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SaveWorkPayload } from "@/lib/admin/work-payload";
import { normalizeTags } from "@/lib/admin/work-utils";

type AdminFailure = {
  ok: false;
  status: number;
  message: string;
};

type AdminSuccess<T> = {
  ok: true;
  data: T;
};

type AdminResult<T> = AdminSuccess<T> | AdminFailure;

type AdminContext = {
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  userId: string;
};

async function getAdminContext(): Promise<AdminResult<AdminContext>> {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false,
        status: 401,
        message: "Your session has expired. Please log in again.",
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return {
        ok: false,
        status: 403,
        message: "You don't have permission to perform this action.",
      };
    }

    return {
      ok: true,
      data: {
        supabase,
        userId: user.id,
      },
    };
  } catch {
    return {
      ok: false,
      status: 500,
      message: "Could not save the work. Please check your connection and try again.",
    };
  }
}

async function syncWorkTags(
  supabase: AdminContext["supabase"],
  workId: string,
  tags: string[],
) {
  const normalized = normalizeTags(tags);

  await supabase.from("work_tags").delete().eq("work_id", workId);
  if (normalized.length === 0) {
    return;
  }

  const { data: upsertedTags } = await supabase
    .from("tags")
    .upsert(normalized.map((name) => ({ name })), { onConflict: "name" })
    .select("id,name");

  if (!upsertedTags || upsertedTags.length === 0) {
    return;
  }

  const workTagsRows = upsertedTags.map((tag) => ({
    work_id: workId,
    tag_id: tag.id,
  }));

  await supabase.from("work_tags").insert(workTagsRows);
}

function normalizeStoragePath(path: string) {
  return path.startsWith(`${BUCKET_NAME}/`)
    ? path.replace(`${BUCKET_NAME}/`, "")
    : path;
}

export async function createWork(
  payload: SaveWorkPayload,
): Promise<AdminResult<{ id: string }>> {
  const context = await getAdminContext();
  if (!context.ok) {
    return context;
  }

  const { supabase } = context.data;

  const { data: createdWork, error: workError } = await supabase
    .from("works")
    .insert({
      description: payload.description || null,
      created_date: payload.createdDate,
    })
    .select("id")
    .single();

  if (workError || !createdWork) {
    return {
      ok: false,
      status: 500,
      message: "Could not save the work. Please check your connection and try again.",
    };
  }

  if (payload.images.length > 0) {
    const { error: imageError } = await supabase.from("images").insert(
      payload.images.map((image) => ({
        id: image.id,
        work_id: createdWork.id,
        storage_path: normalizeStoragePath(image.storagePath),
        width: image.width,
        height: image.height,
        display_order: image.displayOrder,
      })),
    );

    if (imageError) {
      return {
        ok: false,
        status: 500,
        message: "Failed to upload image. Please try again.",
      };
    }
  }

  const coverImageId = payload.coverImageId ?? payload.images[0]?.id ?? null;
  await supabase
    .from("works")
    .update({ cover_image_id: coverImageId })
    .eq("id", createdWork.id);

  await syncWorkTags(supabase, createdWork.id, payload.tags);

  return {
    ok: true,
    data: { id: createdWork.id },
  };
}

export async function updateWork(
  workId: string,
  payload: SaveWorkPayload,
): Promise<AdminResult<{ id: string }>> {
  const context = await getAdminContext();
  if (!context.ok) {
    return context;
  }

  const { supabase } = context.data;

  const { data: existingWork } = await supabase
    .from("works")
    .select("id")
    .eq("id", workId)
    .single();
  if (!existingWork) {
    return {
      ok: false,
      status: 404,
      message: "This work could not be found. It may have been removed.",
    };
  }

  const { error: updateError } = await supabase
    .from("works")
    .update({
      description: payload.description || null,
      created_date: payload.createdDate,
    })
    .eq("id", workId);

  if (updateError) {
    return {
      ok: false,
      status: 500,
      message: "Could not save the work. Please check your connection and try again.",
    };
  }

  const { data: existingImages } = await supabase
    .from("images")
    .select("id,storage_path")
    .eq("work_id", workId);

  const incomingIds = new Set(payload.images.map((image) => image.id));

  if (payload.images.length > 0) {
    const { error: upsertError } = await supabase.from("images").upsert(
      payload.images.map((image) => ({
        id: image.id,
        work_id: workId,
        storage_path: normalizeStoragePath(image.storagePath),
        width: image.width,
        height: image.height,
        display_order: image.displayOrder,
      })),
      { onConflict: "id" },
    );

    if (upsertError) {
      return {
        ok: false,
        status: 500,
        message: "Failed to upload image. Please try again.",
      };
    }
  }

  const deleteIds = (existingImages ?? [])
    .map((image) => image.id)
    .filter((id) => !incomingIds.has(id));
  if (deleteIds.length > 0) {
    await supabase.from("images").delete().in("id", deleteIds);

    const removedStoragePaths = (existingImages ?? [])
      .filter((image) => deleteIds.includes(image.id))
      .map((image) => normalizeStoragePath(image.storage_path));
    if (removedStoragePaths.length > 0) {
      await supabase.storage.from(BUCKET_NAME).remove(removedStoragePaths);
    }
  }

  const coverImageId = payload.coverImageId ?? payload.images[0]?.id ?? null;
  await supabase.from("works").update({ cover_image_id: coverImageId }).eq("id", workId);
  await syncWorkTags(supabase, workId, payload.tags);

  return {
    ok: true,
    data: { id: workId },
  };
}

export async function deleteWork(
  workId: string,
): Promise<AdminResult<{ id: string }>> {
  const context = await getAdminContext();
  if (!context.ok) {
    return context;
  }

  const { supabase } = context.data;
  const { data: existingImages } = await supabase
    .from("images")
    .select("storage_path")
    .eq("work_id", workId);

  const { error } = await supabase.from("works").delete().eq("id", workId);
  if (error) {
    return {
      ok: false,
      status: 500,
      message: "Could not save the work. Please check your connection and try again.",
    };
  }

  const storagePaths = (existingImages ?? []).map((row) =>
    normalizeStoragePath(row.storage_path),
  );
  if (storagePaths.length > 0) {
    await supabase.storage.from(BUCKET_NAME).remove(storagePaths);
  }

  return {
    ok: true,
    data: { id: workId },
  };
}
