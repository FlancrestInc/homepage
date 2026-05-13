import { afterEach, expect, test, vi } from "vitest";
import { getConfig, getPublicSnapshot, saveConfig, searchIcons } from "../../src/client/api";
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

test("getPublicSnapshot summarizes proxy html errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response("<html><head><title>502: Bad gateway</title></head><body>Cloudflare error</body></html>", {
        status: 502,
        headers: { "content-type": "text/html; charset=UTF-8", server: "cloudflare" }
      });
    })
  );

  await expect(getPublicSnapshot()).rejects.toThrow("Failed to load public snapshot: 502 - Cloudflare/proxy returned an HTML error page: 502: Bad gateway");
});

test("text error details are truncated", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response("x".repeat(320), { status: 502, headers: { "content-type": "text/plain" } });
    })
  );

  await expect(getPublicSnapshot()).rejects.toThrow(`${"x".repeat(240)}...`);
});

test("searchIcons passes abort signals to fetch", async () => {
  const controller = new AbortController();
  const fetch = vi.fn(async () => {
    return new Response(JSON.stringify({ icons: [] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);

  await searchIcons("grafana", controller.signal);

  expect(fetch).toHaveBeenCalledWith("/api/icons?q=grafana", { signal: controller.signal });
});

const minimalConfig: AppConfig = {
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
