import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

describe("GET /auth/callback", () => {
  const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);

  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    mockedGetSupabaseServerClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      },
    } as never);
  });

  it("redirects to sanitized fallback when next is external", async () => {
    const response = await GET(
      new Request(
        "http://localhost/auth/callback?code=abc123&next=https://evil.example",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin");
  });

  it.each(["//evil.example", "/\\evil.example", "/%2f%2fevil.example"])(
    "keeps %s on this origin",
    async (next) => {
      const response = await GET(
        new Request(
          `http://localhost/auth/callback?code=abc123&next=${encodeURIComponent(next)}`,
        ),
      );

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      if (!location) throw new Error("missing location header");
      expect(new URL(location, "http://localhost").origin).toBe("http://localhost");
    },
  );

  it("redirects to requested internal path", async () => {
    const response = await GET(
      new Request("http://localhost/auth/callback?code=abc123&next=/admin/new"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/new");
  });
});
