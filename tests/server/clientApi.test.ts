import { afterEach, expect, test, vi } from "vitest";
import { getConfig, saveConfig } from "../../src/client/api";
import type { AppConfig } from "../../src/client/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("saveConfig includes validation issue details from failed responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: "invalid_config",
          issues: [{ path: ["bookmarks", 0, "url"], message: "Invalid url" }]
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    })
  );

  await expect(saveConfig(minimalConfig)).rejects.toThrow("Config save failed: 400 - invalid_config: bookmarks.0.url: Invalid url");
});

test("getConfig includes validation issue details from failed responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: "invalid_config",
          issues: [{ path: ["theme", "mode"], message: "Invalid option" }]
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    })
  );

  await expect(getConfig()).rejects.toThrow("Config request failed: 400 - invalid_config: theme.mode: Invalid option");
});

const minimalConfig: AppConfig = {
  theme: {
    mode: "dark",
    accentColor: "#72a6ff",
    background: {
      type: "color",
      value: "#1d2a3b"
    }
  },
  layout: {
    editorButton: "bottom-right",
    groups: []
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
