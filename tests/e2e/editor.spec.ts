import { expect, test } from "@playwright/test";
import type { AppConfig, BookmarkConfig } from "../../src/client/types";

test("opens editor drawer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("shows bookmark fields", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Bookmarks" }).click();
  await expect(page.getByRole("button", { name: "Add bookmark" })).toBeVisible();
});

test("settings drawer uses an opaque surface", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();

  const backgroundColor = await page.getByRole("dialog", { name: "Settings" }).evaluate((element) => getComputedStyle(element).backgroundColor);

  expect(backgroundColor).toMatch(/^rgb\(/);
});

test("theme background URL advertises still and animated media formats", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Theme" }).click();
  await page.getByLabel("Background type").selectOption("image");

  const backgroundInput = page.getByLabel("Background image URL");

  await expect(backgroundInput).toHaveAttribute("placeholder", /webm/);
  await expect(backgroundInput).toHaveAttribute("placeholder", /jpg/);
});

test("server query fields explain expected query values", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Widgets" }).click();

  await expect(page.getByLabel("CPU query")).toHaveAttribute("title", /Prometheus/);
  await expect(page.getByLabel("RAM query")).toHaveAttribute("title", /percentage/);
});

test("bookmark and group settings are split and collapsible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();

  await expect(page.getByRole("tab", { name: "Groups" })).toBeVisible();
  await page.getByRole("tab", { name: "Bookmarks" }).click();

  const developmentGroup = page.getByRole("button", { name: /Development/ });
  await expect(developmentGroup).toHaveAttribute("aria-expanded", "false");
  await developmentGroup.click();

  const githubBookmark = page.getByRole("button", { name: /GitHub/ });
  await expect(githubBookmark).toHaveAttribute("aria-expanded", "false");
  await githubBookmark.click();

  await expect(page.getByLabel("Bookmark name")).toBeVisible();
  await page.getByRole("tab", { name: "Groups" }).click();
  await expect(page.getByRole("button", { name: "Add group" })).toBeVisible();
});

test("groups editor shows more than twelve groups as collapsible panels", async ({ page }) => {
  await page.route("**/api/config", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: configWithGroups(14) });
      return;
    }

    await route.fallback();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Groups" }).click();

  const lastGroup = page.getByRole("button", { name: /Group 14/ });
  await expect(page.locator(".bookmark-group-editor-panel")).toHaveCount(14);
  await expect(lastGroup).toBeVisible();
  await expect(lastGroup).toHaveAttribute("aria-expanded", "false");

  await lastGroup.click();
  await expect(lastGroup).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".bookmark-group-editor-panel").last().getByLabel("Name")).toHaveValue("Group 14");
});

test("groups editor includes groups used by bookmarks but missing from layout", async ({ page }) => {
  await page.route("**/api/config", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: configWithBookmarkOnlyGroups() });
      return;
    }

    await route.fallback();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Groups" }).click();

  await expect(page.locator(".bookmark-group-editor-panel")).toHaveCount(14);
  await expect(page.getByRole("button", { name: /Misc/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Self-Hosting/ })).toBeVisible();
});

test("bookmark editor stays expanded while typing in text fields", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Bookmarks" }).click();

  await page.getByRole("button", { name: "Add bookmark" }).click();
  await page.locator(".bookmark-editor-group > summary").click();
  await page.locator(".nested-editor-panel > summary").click();
  const bookmarkPanel = page.locator(".nested-editor-panel").first();

  const nameInput = page.getByLabel("Bookmark name");
  await nameInput.fill("");
  await nameInput.pressSequentially("GitLab");

  await expect(bookmarkPanel).toHaveAttribute("open", "");
  await expect(nameInput).toHaveValue("GitLab");
});

test("bookmark editor stays expanded while editing the bookmark group", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Bookmarks" }).click();

  await page.getByRole("button", { name: "Add bookmark" }).click();
  await page.locator(".bookmark-editor-group > summary").click();
  await page.locator(".nested-editor-panel > summary").click();

  const bookmarkPanel = page.locator(".nested-editor-panel").first();
  const groupInput = page.getByLabel("Group");
  await groupInput.fill("");
  await groupInput.pressSequentially("Labs");

  await expect(bookmarkPanel).toHaveAttribute("open", "");
  await expect(groupInput).toHaveValue("Labs");
});

function configWithGroups(count: number): AppConfig {
  return {
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
      editorButton: "bottom-right",
      groups: Array.from({ length: count }, (_, index) => ({
        name: `Group ${index + 1}`,
        order: index,
        columns: 4,
        width: "normal"
      }))
    },
    bookmarks: [],
    widgets: {
      refreshInterval: "30s",
      time: {
        enabled: true,
        format: "MMM d, yyyy h:mm a",
        showSeconds: false,
        hourCycle: "12",
        showTimezone: false
      },
      weather: {
        enabled: false,
        provider: "open-meteo",
        location: "Pleasant Grove, UT",
        units: "imperial",
        refreshInterval: "30m"
      },
      monitors: {
        source: "prometheus",
        historyWindow: "6h",
        sampleInterval: "5m",
        refreshInterval: "5m",
        servers: []
      }
    },
    healthChecks: {
      defaultInterval: "5m",
      timeout: "5s"
    }
  };
}

function configWithBookmarkOnlyGroups() {
  const config = configWithGroups(12);
  config.layout.groups = [
    "AI",
    "Development",
    "Google",
    "Money",
    "Networking",
    "Pinball",
    "Media",
    "Video",
    "Games",
    "Documents",
    "Websites",
    "Fun Tools"
  ].map((name, index) => ({ name, order: index, columns: 3, width: "normal" }));
  config.bookmarks = [
    ...config.layout.groups.map((group, index) => testBookmark(`Bookmark ${index + 1}`, group.name, `https://example.com/${index + 1}`)),
    testBookmark("iCloud", "Misc", "https://example.com/misc"),
    testBookmark("Grafana", "Self-Hosting", "https://example.com/self-hosting")
  ];
  return config;
}

function testBookmark(name: string, group: string, url: string): BookmarkConfig {
  return {
    name,
    group,
    icon: "link",
    iconColor: "#eef5ff",
    url,
    health: {
      mode: "default",
      method: "GET",
      headers: {},
      expectedStatuses: [200, 204, 301, 302, 304, 401, 403]
    }
  };
}
