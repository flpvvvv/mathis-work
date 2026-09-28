import { expect, type Page, test } from "@playwright/test";

/**
 * Opens the first artwork from the gallery and expands it into the full-screen
 * viewer. Like the rest of the public suite this needs seeded Supabase data.
 */
async function openFirstArtwork(page: Page) {
  await page.goto("/");

  const card = page.locator('a[href^="/works/"]').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  const open = page.getByRole("button", {
    name: /^Open image \d+ of \d+ in full screen$/,
  });
  await expect(open).toBeVisible({ timeout: 15_000 });
  await open.click();

  const dialog = page.locator("dialog");
  await expect(dialog).toBeVisible();

  // The track holds [previous, current, next]; the middle slot is the artwork
  // on screen and the only one that carries the zoom transform.
  const artwork = dialog.locator("img").nth(1);
  await expect
    .poll(() => artwork.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);

  return { dialog, artwork };
}

test.describe("Full screen artwork viewer", () => {
  test("keeps the artwork's aspect ratio", async ({ page }) => {
    const { artwork } = await openFirstArtwork(page);

    const { boxRatio, naturalRatio } = await artwork.evaluate((img) => {
      const el = img as HTMLImageElement;
      const rect = el.getBoundingClientRect();
      return {
        boxRatio: rect.width / rect.height,
        naturalRatio: el.naturalWidth / el.naturalHeight,
      };
    });

    // The `width`/`height` attributes act as presentational hints, so without
    // an explicit `width: auto` the flex item kept that hinted width while
    // `max-height` clamped the height — a 1.43 artwork was drawn 1440x900.
    expect(Math.abs(boxRatio / naturalRatio - 1)).toBeLessThan(0.02);
  });

  test("a vertical drag pans the zoomed artwork", async ({ page }) => {
    const { dialog, artwork } = await openFirstArtwork(page);

    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    for (let step = 0; step < 4; step += 1) await zoomIn.click();
    await expect(page.getByTitle("Zoom level")).toHaveText("600%");

    const geometry = await artwork.evaluate((img) => {
      const el = img as HTMLImageElement;
      const stage = el.closest("div[tabindex]") as HTMLElement;
      return { artworkHeight: el.offsetHeight, stageHeight: stage.clientHeight };
    });
    // Vertical panning only exists where the artwork scaled past the viewport;
    // an artwork wider than roughly 9:1 has none, so there is nothing to check.
    test.skip(
      geometry.artworkHeight * 6 <= geometry.stageHeight,
      "artwork is too wide to have vertical slack",
    );

    const stage = dialog.locator("div[tabindex]");
    const box = (await stage.boundingBox())!;
    const x = box.x + box.width / 2;
    const startY = box.y + box.height * 0.35;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    for (let step = 1; step <= 8; step += 1) {
      await page.mouse.move(x, startY + (step * 80) / 8);
    }
    await page.mouse.up();

    // The axis of the first movement used to be locked in: a drag that started
    // vertically was dropped instead of panning, while a horizontal start
    // moved the artwork on both axes.
    const match = /translate3d\(0px, ([\d.]+)px, 0px\) scale\(6\)/.exec(
      await artwork.evaluate((img) => (img as HTMLElement).style.transform),
    );
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThan(0);
  });
});
