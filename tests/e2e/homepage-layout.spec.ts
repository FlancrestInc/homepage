import { expect, test } from "@playwright/test";

test.describe("desktop layout", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout assertion only applies to desktop viewport.");

  test("desktop homepage renders without vertical scrolling", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".app-shell")).toBeVisible();
    const hasVerticalScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);

    expect(hasVerticalScroll).toBe(false);
  });
});

test("editor button is visible", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
});
