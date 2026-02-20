import { describe, expect, it } from "vitest";

import { normalizeTags, resolveCoverImageId } from "@/lib/admin/work-utils";

describe("normalizeTags", () => {
  it("trims, lowercases, and deduplicates tags", () => {
    expect(
      normalizeTags(["  Portrait ", "portrait", "WATERCOLOR", "", " watercolor "]),
    ).toEqual(["portrait", "watercolor"]);
  });
});

describe("resolveCoverImageId", () => {
  it("keeps selected cover if it exists", () => {
    expect(
      resolveCoverImageId(
        [
          { id: "a" },
          { id: "b" },
        ],
        "b",
      ),
    ).toBe("b");
  });

  it("falls back to first image when selected cover is missing", () => {
    expect(
      resolveCoverImageId(
        [
          { id: "a" },
          { id: "b" },
        ],
        "c",
      ),
    ).toBe("a");
  });

  it("returns null when there are no images", () => {
    expect(resolveCoverImageId([], null)).toBeNull();
  });
});
