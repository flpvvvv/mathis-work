import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteWork, updateWork } from "@/lib/server/admin-works";

import { DELETE, PATCH } from "./route";

vi.mock("@/lib/server/admin-works", () => ({
  updateWork: vi.fn(),
  deleteWork: vi.fn(),
}));

describe("/api/admin/works/[id]", () => {
  const mockedUpdateWork = vi.mocked(updateWork);
  const mockedDeleteWork = vi.mocked(deleteWork);

  beforeEach(() => {
    mockedUpdateWork.mockReset();
    mockedDeleteWork.mockReset();
  });

  it("PATCH returns success payload", async () => {
    mockedUpdateWork.mockResolvedValue({
      ok: true,
      data: { id: "work_1" },
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/works/work_1", {
        method: "PATCH",
        body: JSON.stringify({
          description: "updated",
          createdDate: "2026-02-20",
          tags: ["portrait"],
          coverImageId: null,
          images: [],
        }),
      }),
      { params: Promise.resolve({ id: "work_1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "work_1" });
  });

  it("PATCH forwards errors", async () => {
    mockedUpdateWork.mockResolvedValue({
      ok: false,
      status: 404,
      message: "This work could not be found. It may have been removed.",
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/works/missing", {
        method: "PATCH",
        body: JSON.stringify({
          description: "updated",
          createdDate: "2026-02-20",
          tags: [],
          coverImageId: null,
          images: [],
        }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
  });

  it("DELETE returns success payload", async () => {
    mockedDeleteWork.mockResolvedValue({
      ok: true,
      data: { id: "work_1" },
    });

    const response = await DELETE(
      new Request("http://localhost/api/admin/works/work_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "work_1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "work_1" });
  });
});
