import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/utils";

describe("safeInternalPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeInternalPath("/admin/new")).toBe("/admin/new");
    expect(safeInternalPath("/?mode=grid")).toBe("/?mode=grid");
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example",
    "admin",
    "",
    null,
    undefined,
  ])("rejects %s", (value) => {
    expect(safeInternalPath(value, "/admin")).toBe("/admin");
  });
});
