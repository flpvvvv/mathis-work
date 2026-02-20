import { cache } from "react";

import type { Work } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type GalleryFilters = {
  query?: string;
  tags?: string[];
  from?: string;
  to?: string;
};

type WorksPageInput = {
  page?: number;
  pageSize?: number;
  filters?: GalleryFilters;
};

type WorksPageResult = {
  items: Work[];
  nextPage: number | null;
  total: number;
};

type RawWork = {
  id: string;
  description: string | null;
  created_date: string;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
  images: Work["images"];
  work_tags?:
    | {
        tags?:
          | {
              id: string;
              name: string;
            }
          | {
              id: string;
              name: string;
            }[]
          | null;
      }[]
    | null;
};

function toWork(item: RawWork, options?: { coverOnly?: boolean }): Work {
  const sortedImages = (item.images ?? []).toSorted(
    (a, b) => a.display_order - b.display_order,
  );
  const coverImage =
    sortedImages.find((image) => image.id === item.cover_image_id) ?? sortedImages[0];

  return {
    id: item.id,
    description: item.description,
    created_date: item.created_date,
    cover_image_id: item.cover_image_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    // Public gallery only needs one image, which reduces client payload size.
    images: options?.coverOnly ? (coverImage ? [coverImage] : []) : sortedImages,
    tags: (item.work_tags ?? []).flatMap((entry) => {
      if (!entry.tags) {
        return [];
      }
      return Array.isArray(entry.tags) ? entry.tags : [entry.tags];
    }),
  };
}

export async function getWorksPage({
  page = 1,
  pageSize = 20,
  filters,
}: WorksPageInput = {}): Promise<WorksPageResult> {
  try {
    const supabase = await getSupabaseServerClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let matchedIds: string[] | undefined;
    if (filters?.tags?.length) {
      const { data: tagMatches } = await supabase
        .from("work_tags")
        .select("work_id,tags!inner(name)")
        .in("tags.name", filters.tags);

      const idSet = new Set((tagMatches ?? []).map((row) => row.work_id));
      matchedIds = Array.from(idSet);
      if (matchedIds.length === 0) {
        return { items: [], nextPage: null, total: 0 };
      }
    }

    let query = supabase
      .from("works")
      .select(
        "id,description,created_date,cover_image_id,created_at,updated_at,images(id,work_id,storage_path,width,height,display_order,created_at),work_tags(tags(id,name))",
        { count: "exact" },
      )
      .order("created_date", { ascending: false });

    if (filters?.query?.trim()) {
      query = query.textSearch("description_tsv", filters.query.trim(), {
        config: "simple",
        type: "websearch",
      });
    }
    if (filters?.from) {
      query = query.gte("created_date", filters.from);
    }
    if (filters?.to) {
      query = query.lte("created_date", filters.to);
    }
    if (matchedIds) {
      query = query.in("id", matchedIds);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) {
      return { items: [], nextPage: null, total: 0 };
    }

    const mapped = (data ?? []).map((item) =>
      toWork(item as RawWork, { coverOnly: true }),
    );
    const total = count ?? mapped.length;
    const loaded = from + mapped.length;

    return {
      items: mapped,
      total,
      nextPage: loaded < total ? page + 1 : null,
    };
  } catch {
    return { items: [], nextPage: null, total: 0 };
  }
}

export async function getWorkById(id: string): Promise<Work | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("works")
      .select(
        "id,description,created_date,cover_image_id,created_at,updated_at,images(id,work_id,storage_path,width,height,display_order,created_at),work_tags(tags(id,name))",
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return toWork(data as RawWork);
  } catch {
    return null;
  }
}

export const getTagList = cache(async (): Promise<string[]> => {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("tags")
      .select("name")
      .order("name", { ascending: true });
    if (error) {
      return [];
    }
    return (data ?? []).map((item) => item.name);
  } catch {
    return [];
  }
});
