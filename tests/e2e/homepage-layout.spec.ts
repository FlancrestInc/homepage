import { expect, test } from "@playwright/test";
import type { PublicSnapshot } from "../../src/client/types";

test.describe("desktop layout", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout assertion only applies to desktop viewport.");

  test("desktop homepage renders without vertical scrolling", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".app-shell")).toBeVisible();
    await expect(page.locator(".bookmark-group").first()).toBeVisible();
    const hasVerticalScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);

    expect(hasVerticalScroll).toBe(false);
  });

  test("desktop homepage scrolls when the window is too short for the content", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 360 });
    await page.route("**/api/bookmarks-snapshot", async (route) => {
      await route.fulfill({ json: bookmarkSnapshotWithGroups(14) });
    });

    await page.goto("/");
    await expect(page.locator(".bookmark-group").last()).toBeVisible();

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
  await page.route("**/api/widgets-snapshot", async (route) => {
    const snapshot = publicSnapshotWithMonitor();
    await route.fulfill({ json: { generatedAt: snapshot.generatedAt, widgets: snapshot.widgets } });
  });
  await page.goto("/");

  const graph = page.getByRole("img", { name: /CPU and RAM history/ }).first();

  await expect(graph).toBeVisible();
  await expect(graph.getByText("100%")).toBeVisible();
  await expect(graph.getByText("0%", { exact: true })).toBeVisible();
  await expect(graph.getByText(/Start/)).toBeVisible();
});

test("renders bookmarks before the widget response completes", async ({ page }) => {
  await page.route("**/api/widgets-snapshot", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const snapshot = publicSnapshotWithMonitor();
    await route.fulfill({ json: { generatedAt: snapshot.generatedAt, widgets: snapshot.widgets } });
  });

  await page.goto("/");
  await expect(page.locator(".bookmark-group").first()).toBeVisible();
  await expect(page.locator(".widget-band")).toHaveCount(0);
  await expect(page.locator(".widget-band")).toBeVisible();
});

function publicSnapshotWithGroups(count: number): PublicSnapshot {
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

function publicSnapshotWithMonitor(): PublicSnapshot {
  const snapshot = publicSnapshotWithGroups(0);
  snapshot.widgets.monitors = [{
    name: "Test server",
    updatedAt: "2026-05-11T17:20:00.000Z",
    cpu: { current: 42, history: [{ timestamp: "2026-05-11T17:15:00.000Z", value: 42 }] },
    ram: { current: 58, history: [{ timestamp: "2026-05-11T17:15:00.000Z", value: 58 }] }
  }];
  return snapshot;
}

function bookmarkSnapshotWithGroups(count: number) {
  const snapshot = publicSnapshotWithGroups(count);
  return {
    generatedAt: snapshot.generatedAt,
    theme: snapshot.theme,
    layout: snapshot.layout,
    groups: snapshot.groups
  };
}
