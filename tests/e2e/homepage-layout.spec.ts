import { expect, test } from "@playwright/test";

test.describe("desktop layout", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout assertion only applies to desktop viewport.");

  test("desktop homepage renders without vertical scrolling", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".app-shell")).toBeVisible();
    const hasVerticalScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);

    expect(hasVerticalScroll).toBe(false);
  });

  test("desktop homepage scrolls when the window is too short for the content", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 360 });
    await page.route("**/api/public-snapshot", async (route) => {
      await route.fulfill({ json: publicSnapshotWithGroups(14) });
    });

    await page.goto("/");

    const hasVerticalScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(hasVerticalScroll).toBe(true);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});

test("editor button is visible", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
});

test("monitor graphs label percentage and time axes", async ({ page }) => {
  await page.goto("/");

  const graph = page.getByRole("img", { name: /CPU and RAM history/ }).first();

  await expect(graph.getByText("100%")).toBeVisible();
  await expect(graph.getByText("0%")).toBeVisible();
  await expect(graph.getByText(/Start/)).toBeVisible();
});

function publicSnapshotWithGroups(count: number) {
  return {
    generatedAt: new Date().toISOString(),
    theme: {
      mode: "dark",
      accentColor: "#72a6ff",
      background: {
        type: "color",
        value: "#1d2a3b",
        style: "cover"
      }
    },
    layout: {
      editorButton: "bottom-right"
    },
    widgets: {
      refreshInterval: "30s",
      time: {
        enabled: true,
        format: "MMM d, yyyy h:mm a",
        showSeconds: false,
        hourCycle: "12",
        showTimezone: false
      },
      weather: null,
      monitors: []
    },
    groups: Array.from({ length: count }, (_, groupIndex) => ({
      name: `Group ${groupIndex + 1}`,
      order: groupIndex,
      columns: 4,
      width: "normal",
      bookmarks: Array.from({ length: 4 }, (_, bookmarkIndex) => ({
        name: `Bookmark ${groupIndex + 1}-${bookmarkIndex + 1}`,
        group: `Group ${groupIndex + 1}`,
        icon: "link",
        iconColor: "#eef5ff",
        url: `https://example.com/${groupIndex + 1}/${bookmarkIndex + 1}`,
        healthMode: "default",
        status: "unknown"
      }))
    }))
  };
}
