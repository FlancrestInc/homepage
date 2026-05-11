import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJsonCache, writeJsonCache } from "../../src/server/cache/cacheStore";
import { bookmarkHealthKey, buildPublicSnapshot } from "../../src/server/cache/publicSnapshot";
import type { AppConfig } from "../../src/server/config/schema";

const config: AppConfig = {
  theme: { mode: "dark", accentColor: "#72a6ff", background: { type: "color", value: "#1d2a3b" } },
  layout: {
    editorButton: "bottom-right",
    groups: [
      { name: "Development", order: 2 },
      { name: "Common", order: 1 },
      { name: "Empty", order: 3 }
    ]
  },
  bookmarks: [
    { name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com", health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] } },
    { name: "Search", group: "Common", icon: "mdi-magnify", url: "https://google.com", health: { mode: "disabled", method: "GET", headers: {}, expectedStatuses: [200] } },
    { name: "Docs", group: "Unconfigured", icon: "mdi-book-open-page-variant", url: "https://docs.example.com", health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] } }
  ],
  widgets: {
    refreshInterval: "30s",
    time: { enabled: true, format: "MMM d, yyyy h:mm a", showSeconds: false, hourCycle: "12", showTimezone: false },
    weather: { enabled: false, provider: "open-meteo", location: "Pleasant Grove, UT", units: "imperial", refreshInterval: "30m" },
    monitors: { source: "prometheus", historyWindow: "6h", sampleInterval: "5m", refreshInterval: "5m", servers: [] }
  },
  healthChecks: { defaultInterval: "5m", timeout: "5s" }
};

describe("buildPublicSnapshot", () => {
  it("orders groups and bookmarks predictably", () => {
    const snapshot = buildPublicSnapshot(config, { health: {}, weather: null, monitors: [] });
    expect(snapshot.groups.map((group) => group.name)).toEqual(["Common", "Development", "Empty", "Unconfigured"]);
    expect(snapshot.groups[0]?.bookmarks[0]?.name).toBe("Search");
    expect(snapshot.groups[2]?.bookmarks).toEqual([]);
    expect(snapshot.groups[3]?.bookmarks[0]?.name).toBe("Docs");
  });

  it("attaches cached health status to bookmarks", () => {
    const snapshot = buildPublicSnapshot(config, {
      health: { [bookmarkHealthKey(config.bookmarks[0]!)]: { status: "down", checkedAt: "2026-05-11T17:00:00.000Z" } },
      weather: null,
      monitors: []
    });
    expect(snapshot.groups[1]?.bookmarks[0]?.status).toBe("down");
  });

  it("uses group, name, and url to attach health for duplicate bookmark names", () => {
    const duplicateConfig: AppConfig = {
      ...config,
      layout: {
        ...config.layout,
        groups: [
          { name: "Common", order: 1 },
          { name: "Development", order: 2 }
        ]
      },
      bookmarks: [
        { name: "Portal", group: "Common", icon: "mdi-web", url: "https://portal.example.com", health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] } },
        { name: "Portal", group: "Development", icon: "mdi-web", url: "https://dev-portal.example.com", health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] } }
      ]
    };

    const snapshot = buildPublicSnapshot(duplicateConfig, {
      health: {
        [bookmarkHealthKey(duplicateConfig.bookmarks[0]!)]: { status: "up", checkedAt: "2026-05-11T17:00:00.000Z" },
        [bookmarkHealthKey(duplicateConfig.bookmarks[1]!)]: { status: "down", checkedAt: "2026-05-11T17:01:00.000Z" }
      },
      weather: null,
      monitors: []
    });

    expect(snapshot.groups[0]?.bookmarks[0]?.status).toBe("up");
    expect(snapshot.groups[1]?.bookmarks[0]?.status).toBe("down");
  });
});

describe("JSON cache store", () => {
  it("writes then reads JSON", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-cache-"));
    const cachePath = path.join(dir, "cache.json");

    await writeJsonCache(cachePath, { health: { GitHub: { status: "up" } } });

    await expect(readJsonCache(cachePath, {})).resolves.toEqual({ health: { GitHub: { status: "up" } } });
    await expect(readFile(cachePath, "utf8")).resolves.toContain("\n");
  });

  it("returns fallback for missing or invalid JSON", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-cache-"));
    const missingPath = path.join(dir, "missing.json");
    const invalidPath = path.join(dir, "invalid.json");

    await writeFile(invalidPath, "{not-json", "utf8");

    await expect(readJsonCache(missingPath, { fallback: true })).resolves.toEqual({ fallback: true });
    await expect(readJsonCache(invalidPath, ["fallback"])).resolves.toEqual(["fallback"]);
  });
});
