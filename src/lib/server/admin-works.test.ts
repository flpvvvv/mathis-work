import { describe, expect, it, vi } from "vitest";

import type { SaveWorkPayload } from "@/lib/admin/work-payload";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const holder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => holder.client,
}));

import { deleteWork, updateWork } from "@/lib/server/admin-works";

type ChainResult = { data?: unknown; error?: unknown };

type FakeBuilder = {
  select: () => FakeBuilder;
  insert: () => FakeBuilder;
  update: () => FakeBuilder;
  upsert: () => FakeBuilder;
  delete: () => FakeBuilder;
  eq: () => FakeBuilder;
  in: (column: string, values: string[]) => FakeBuilder;
  single: () => Promise<ChainResult>;
  then: (
    resolve: (value: ChainResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

function makeBuilder(
  table: string,
  results: Record<string, ChainResult>,
  log: string[],
): FakeBuilder {
  let op = "select";
  let suffix = "";

  const settle = () => {
    log.push(`${table}.${op}${suffix}`);
    return Promise.resolve(results[`${table}.${op}`] ?? { data: null, error: null });
  };

  const builder: FakeBuilder = {
    select: () => ((op = "select"), builder),
    insert: () => ((op = "insert"), builder),
    update: () => ((op = "update"), builder),
    upsert: () => ((op = "upsert"), builder),
    delete: () => ((op = "delete"), builder),
    eq: () => builder,
    in: (_column, values) => ((suffix = `(${values.join("|")})`), builder),
    single: () => settle(),
    then: (resolve, reject) => settle().then(resolve, reject),
  };

  return builder;
}

function createClient(options: {
  results?: Record<string, ChainResult>;
  storageError?: { message: string } | null;
}) {
  const log: string[] = [];
  const results = options.results ?? {};

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from: (table: string) => makeBuilder(table, results, log),
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          log.push(`storage.remove(${paths.join("|")})`);
          return { data: [], error: options.storageError ?? null };
        },
      }),
    },
  };

  return {
    log,
    client: client as unknown as SupabaseServerClient,
  };
}

const WORK_ID = "w1";
const PAYLOAD: SaveWorkPayload = {
  description: "",
  createdDate: "2026-01-01",
  tags: [],
  coverImageId: "keep",
  images: [
    {
      id: "keep",
      storagePath: "w1/keep.jpg",
      width: 10,
      height: 10,
      displayOrder: 0,
    },
  ],
};

const ADMIN_RESULTS: Record<string, ChainResult> = {
  "profiles.select": { data: { is_admin: true } },
  "works.select": { data: { id: WORK_ID } },
};

const REMOVE_PATH = "w1/gone.jpg";

describe("updateWork with an image removed in the editor", () => {
  it("deletes the file before its row", async () => {
    const { client, log } = createClient({
      storageError: null,
      results: {
        ...ADMIN_RESULTS,
        "images.select": {
          data: [
            { id: "keep", storage_path: "w1/keep.jpg" },
            { id: "gone", storage_path: REMOVE_PATH },
          ],
        },
      },
    });
    holder.client = client;

    const result = await updateWork(WORK_ID, PAYLOAD);

    expect(result).toEqual({ ok: true, data: { id: WORK_ID } });
    expect(log.indexOf(`storage.remove(${REMOVE_PATH})`)).toBeGreaterThan(-1);
    expect(log.indexOf("images.delete(gone)")).toBeGreaterThan(
      log.indexOf(`storage.remove(${REMOVE_PATH})`),
    );
  });

  it("keeps the row and fails the save when the file cannot be deleted", async () => {
    const { client, log } = createClient({
      storageError: { message: "new row violates row-level security policy" },
      results: {
        ...ADMIN_RESULTS,
        "images.select": {
          data: [
            { id: "keep", storage_path: "w1/keep.jpg" },
            { id: "gone", storage_path: REMOVE_PATH },
          ],
        },
      },
    });
    holder.client = client;

    const result = await updateWork(WORK_ID, PAYLOAD);

    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(log.some((call) => call.startsWith("images.delete"))).toBe(false);
  });
});

describe("deleteWork", () => {
  it("deletes the files before the work row", async () => {
    const { client, log } = createClient({
      storageError: null,
      results: {
        ...ADMIN_RESULTS,
        "images.select": {
          data: [{ storage_path: "w1/keep.jpg" }, { storage_path: REMOVE_PATH }],
        },
      },
    });
    holder.client = client;

    const result = await deleteWork(WORK_ID);

    expect(result).toEqual({ ok: true, data: { id: WORK_ID } });
    expect(log.indexOf(`storage.remove(w1/keep.jpg|${REMOVE_PATH})`)).toBeGreaterThan(-1);
    expect(log.indexOf("works.delete")).toBeGreaterThan(
      log.indexOf(`storage.remove(w1/keep.jpg|${REMOVE_PATH})`),
    );
  });

  it("keeps the work and reports failure when the files cannot be deleted", async () => {
    const { client, log } = createClient({
      storageError: { message: "new row violates row-level security policy" },
      results: {
        ...ADMIN_RESULTS,
        "images.select": { data: [{ storage_path: REMOVE_PATH }] },
      },
    });
    holder.client = client;

    const result = await deleteWork(WORK_ID);

    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(log).not.toContain("works.delete");
  });
});
