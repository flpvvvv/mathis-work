import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWork } from "@/lib/server/admin-works";

import { POST } from "./route";

vi.mock("@/lib/server/admin-works", () => ({
  createWork: vi.fn(),
}));

describe("POST /api/admin/works", () => {
  const mockedCreateWork = vi.mocked(createWork);

  beforeEach(() => {
    mockedCreateWork.mockReset();
  });

  it("returns 201 on success", async () => {
    mockedCreateWork.mockResolvedValue({
      ok: true,
      data: { id: "work_1" },
    });

    const response = await POST(
      new Request("http://localhost/api/admin/works", {
        method: "POST",
        body: JSON.stringify({
          description: "test",
          createdDate: "2026-02-20",
          tags: [],
          coverImageId: null,
          images: [],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "work_1" });
  });

  it("returns error status from createWork", async () => {
    mockedCreateWork.mockResolvedValue({
      ok: false,
      status: 403,
      message: "You don't have permission to perform this action.",
    });

    const response = await POST(
      new Request("http://localhost/api/admin/works", {
        method: "POST",
        body: JSON.stringify({
          description: "test",
          createdDate: "2026-02-20",
          tags: [],
          coverImageId: null,
          images: [],
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: "You don't have permission to perform this action.",
    });
  });

  it("returns 400 for invalid JSON payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/works", {
        method: "POST",
        body: "{invalid-json",
      }),
    );

    expect(response.status).toBe(400);
  });
});
