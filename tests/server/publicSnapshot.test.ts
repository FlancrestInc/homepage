import { describe, expect, it } from "vitest";
import { buildPublicSnapshot } from "../../src/server/cache/publicSnapshot";
import type { AppConfig } from "../../src/server/config/schema";

const config: AppConfig = {
  theme: { mode: "dark", accentColor: "#72a6ff", background: { type: "color", value: "#1d2a3b" } },
  layout: {
    editorButton: "bottom-right",
    groups: [
      { name: "Development", order: 2 },
      { name: "Common", order: 1 }
    ]
  },
  bookmarks: [
    { name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com", health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] } },
    { name: "Search", group: "Common", icon: "mdi-magnify", url: "https://google.com", health: { mode: "disabled", method: "GET", headers: {}, expectedStatuses: [200] } }
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
    expect(snapshot.groups.map((group) => group.name)).toEqual(["Common", "Development"]);
    expect(snapshot.groups[0]?.bookmarks[0]?.name).toBe("Search");
  });

  it("attaches cached health status to bookmarks", () => {
    const snapshot = buildPublicSnapshot(config, {
      health: { GitHub: { status: "down", checkedAt: "2026-05-11T17:00:00.000Z" } },
      weather: null,
      monitors: []
    });
    expect(snapshot.groups[1]?.bookmarks[0]?.status).toBe("down");
  });
});
