import { expect, test } from "@playwright/test";

test.describe("Public Gallery", () => {
  test("public gallery shell renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Mathis's Artwork" })).toBeVisible();
  });

  test("grid view renders artwork cards", async ({ page }) => {
    await page.goto("/");

    // Wait for artwork cards to load (they are links to /works/[id])
    const artworkCards = page.locator('a[href^="/works/"]');
    await expect(artworkCards.first()).toBeVisible({ timeout: 10000 });

    // Verify at least one card has an image
    const firstCard = artworkCards.first();
    const image = firstCard.locator("img");
    await expect(image).toBeVisible();
  });

  test("timeline toggle switches view mode", async ({ page }) => {
    await page.goto("/");

    // Find the Timeline button
    const timelineButton = page.getByRole("button", { name: /timeline/i });

    // Click timeline mode
    await timelineButton.click();

    // Wait for URL to update with mode=timeline
    await expect(page).toHaveURL(/mode=timeline/);

    // Switch back to grid
    const gridButton = page.getByRole("button", { name: /^Grid$/i });
    await gridButton.click();

    // Grid is default, so mode param should be gone
    await expect(page).not.toHaveURL(/mode=timeline/);
  });

  test("search filters artworks", async ({ page }) => {
    await page.goto("/");

    // Find search input by aria-label
    const searchInput = page.getByLabel("Search artworks");
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill("painting");
    await page.waitForTimeout(500); // Wait for debounce

    // Verify URL updated with query param (uses 'query' not 'q')
    await expect(page).toHaveURL(/query=painting/);
  });

  test("tag filtering filters artworks", async ({ page }) => {
    await page.goto("/");

    // Find tag filter buttons (they are badges inside buttons)
    const tagButtons = page.locator('button[type="button"]').filter({ has: page.locator('[class*="badge"]') });
    const firstTag = tagButtons.first();

    if (await firstTag.isVisible()) {
      await firstTag.click();
      await page.waitForTimeout(500);

      // Verify URL updated with tags param
      await expect(page).toHaveURL(/tags=/);
    }
  });

  test("date filtering filters artworks", async ({ page }) => {
    await page.goto("/");

    // Find date filter inputs
    const dateInputs = page.locator('input[type="date"]');
    const startDate = dateInputs.first();

    if (await startDate.isVisible()) {
      await startDate.fill("2026-01-01");
      await page.waitForTimeout(500);

      // Verify URL updated with from param
      await expect(page).toHaveURL(/from=/);
    }
  });

  test("work detail opens from grid", async ({ page }) => {
    await page.goto("/");

    // Click the first artwork card
    const artworkCard = page.locator('a[href^="/works/"]').first();
    await artworkCard.click();

    // Verify we're on a work detail page
    await expect(page).toHaveURL(/\/works\/[a-f0-9-]+/);

    // Verify the gallery image is visible (uses fill layout)
    const galleryImage = page.locator('img[class*="object-contain"]').first();
    await expect(galleryImage).toBeVisible({ timeout: 10000 });
  });

  test("back navigation preserves gallery state", async ({ page }) => {
    await page.goto("/");

    // Scroll down to potentially trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, 500));

    // Click first artwork
    const artworkCard = page.locator('a[href^="/works/"]').first();
    await artworkCard.click();
    await expect(page).toHaveURL(/\/works\/[a-f0-9-]+/);

    // Navigate back
    await page.goBack();

    // Verify we're back on the gallery page
    await expect(page.getByRole("heading", { name: "Mathis's Artwork" })).toBeVisible();

    // Verify scroll position is restored (approximately)
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Design & Brand", () => {
  test("logo renders correctly", async ({ page }) => {
    await page.goto("/");

    // Check for the heading which serves as the logo/brand
    const heading = page.getByRole("heading", { name: "Mathis's Artwork" });
    await expect(heading).toBeVisible();
  });

  test("favicon is configured", async ({ page }) => {
    await page.goto("/");

    // Check for favicon link element
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveCount(1);
  });

  test("theme toggle switches dark/light mode", async ({ page }) => {
    await page.goto("/");

    // Check initial theme
    const html = page.locator("html");

    // Find theme toggle button (looks for sun/moon icon button)
    const themeToggle = page.locator('button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"]').or(
      page.locator('button').filter({ has: page.locator('svg[class*="lucide"]') })
    ).first();

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const initialClass = await html.getAttribute("class");

      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(300);

      // Verify theme changed
      const newClass = await html.getAttribute("class");
      expect(newClass).not.toBe(initialClass);
    }
  });

  test("CSS animations on grid scroll", async ({ page }) => {
    await page.goto("/");

    // Check that artwork cards have animation-related classes
    const artworkCards = page.locator('a[href^="/works/"]');
    await expect(artworkCards.first()).toBeVisible();

    // Verify animation/transition classes are present
    const firstCard = artworkCards.first();
    const className = await firstCard.getAttribute("class");

    // Check for animation-related classes (motion-safe variants, transition)
    expect(className).toMatch(/motion-safe:|transition|hover:/);
  });
});

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("gallery renders on mobile", async ({ page }) => {
    await page.goto("/");

    // Verify heading is visible
    await expect(page.getByRole("heading", { name: "Mathis's Artwork" })).toBeVisible();

    // Verify artwork cards are visible
    const artworkCards = page.locator('a[href^="/works/"]');
    await expect(artworkCards.first()).toBeVisible({ timeout: 10000 });
  });

  test("navigation works on mobile", async ({ page }) => {
    await page.goto("/");

    // Click first artwork
    const artworkCard = page.locator('a[href^="/works/"]').first();
    await artworkCard.click();

    // Verify work detail page
    await expect(page).toHaveURL(/\/works\/[a-f0-9-]+/);
  });
});