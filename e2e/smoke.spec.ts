import { expect, test } from "@playwright/test";

test("public gallery shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mathis's Artwork" })).toBeVisible();
});
