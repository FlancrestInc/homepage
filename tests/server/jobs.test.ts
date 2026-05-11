import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { bookmarkHealthKey } from "../../src/server/cache/publicSnapshot";
import type { Bookmark } from "../../src/server/config/schema";
import type { AppEnv } from "../../src/server/env";
import { queryPrometheusRange } from "../../src/server/integrations/prometheus";
import { refreshHealthChecks } from "../../src/server/jobs/healthChecks";
import { type MonitorCard, refreshMonitors } from "../../src/server/jobs/monitors";
import { createNoOverlapRunner, startScheduler } from "../../src/server/jobs/scheduler";
import { refreshWeather } from "../../src/server/jobs/weather";

describe("health checks", () => {
  it("skips bookmarks with disabled health checks", async () => {
    const fetchMock = vi.fn();
    await refreshHealthChecks({
      bookmarks: [
        {
          name: "Local",
          group: "Common",
          icon: "mdi-home",
          url: "https://local.example.com",
          health: { mode: "disabled", method: "GET", headers: {}, expectedStatuses: [200] }
        }
      ],
      timeout: 1000,
      fetchImpl: fetchMock
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a bookmark down when the response status is unexpected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 500 });
    const bookmark: Bookmark = {
      name: "Grafana",
      group: "Self-Hosting",
      icon: "si-grafana",
      url: "https://grafana.example.com",
      health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] }
    };

    const result = await refreshHealthChecks({
      bookmarks: [bookmark],
      timeout: 1000,
      fetchImpl: fetchMock
    });

    expect(result[bookmarkHealthKey(bookmark)]?.status).toBe("down");
  });

  it("uses custom health URL, method, and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    const bookmark: Bookmark = {
      name: "API",
      group: "Services",
      icon: "mdi-api",
      url: "https://api.example.com",
      health: {
        mode: "custom",
        url: "https://api.example.com/ready",
        method: "POST",
        headers: { Authorization: "Bearer token" },
        expectedStatuses: [204]
      }
    };

    const result = await refreshHealthChecks({ bookmarks: [bookmark], timeout: 1000, fetchImpl: fetchMock });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/ready", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      signal: expect.any(AbortSignal)
    });
    expect(result[bookmarkHealthKey(bookmark)]?.status).toBe("up");
  });
});

describe("prometheus integration", () => {
  it("maps range query values into UTC timestamp/value points", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", data: { result: [{ values: [[1778520000, "42.5"]] }] } })
    });

    const points = await queryPrometheusRange({
      baseUrl: "http://prometheus:9090",
      query: "up",
      start: 1778520000,
      end: 1778520300,
      step: "5m",
      fetchImpl: fetchMock
    });

    expect(points).toEqual([{ timestamp: "2026-05-11T17:20:00.000Z", value: 42.5 }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), { signal: expect.any(AbortSignal) });
  });

  it("returns an empty array for empty Prometheus results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", data: { result: [] } })
    });

    await expect(queryPrometheusRange({
      baseUrl: "http://prometheus:9090",
      query: "up",
      start: 1778520000,
      end: 1778520300,
      step: "5m",
      fetchImpl: fetchMock
    })).resolves.toEqual([]);
  });

  it("throws useful errors for malformed Prometheus values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", data: { result: [{ values: [[1778520000, "not-a-number"]] }] } })
    });

    await expect(queryPrometheusRange({
      baseUrl: "http://prometheus:9090",
      query: "up",
      start: 1778520000,
      end: 1778520300,
      step: "5m",
      fetchImpl: fetchMock
    })).rejects.toThrow(/value/i);
  });
});

describe("weather job", () => {
  it("does not call external weather service when disabled", async () => {
    const fetchMock = vi.fn();
    const result = await refreshWeather({
      enabled: false,
      provider: "open-meteo",
      location: "Pleasant Grove, UT",
      units: "imperial",
      refreshInterval: "30m"
    }, fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.condition).toBe("disabled");
  });
});

describe("monitor jobs", () => {
  it("accumulates bounded Glances history from previous cache data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 33 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ percent: 44 }) });
    const previous: MonitorCard[] = [{
      name: "NAS",
      updatedAt: "2026-05-11T17:15:00.000Z",
      cpu: { current: 22, history: [{ timestamp: "2026-05-11T17:15:00.000Z", value: 22 }] },
      ram: { current: 35, history: [{ timestamp: "2026-05-11T17:15:00.000Z", value: 35 }] }
    }];

    const result = await refreshMonitors({
      source: "glances",
      historyWindow: "1d",
      sampleInterval: "5m",
      refreshInterval: "5m",
      servers: [{ name: "NAS", source: "glances", enabled: true, glancesUrl: "http://nas:61208" }]
    }, fetchMock, previous);

    expect(result[0]?.cpu.current).toBe(33);
    expect(result[0]?.ram.current).toBe(44);
    expect(result[0]?.cpu.history.map((point) => point.value)).toEqual([22, 33]);
    expect(result[0]?.ram.history.map((point) => point.value)).toEqual([35, 44]);
  });
});

describe("scheduler", () => {
  it("does not overlap runs while a previous run is pending", async () => {
    let resolveFirstRun: () => void = () => undefined;
    const job = vi.fn(() => new Promise<void>((resolve) => {
      resolveFirstRun = resolve;
    }));
    const runner = createNoOverlapRunner(job);

    runner();
    runner();

    expect(job).toHaveBeenCalledTimes(1);
    resolveFirstRun();
    await Promise.resolve();
    await Promise.resolve();

    runner();
    expect(job).toHaveBeenCalledTimes(2);
  });

  it("returns before immediate external job fetches settle", async () => {
    const env = await createTestEnv();
    await writeFile(env.configPath, `
widgets:
  weather:
    enabled: true
    latitude: 40.36
    longitude: -111.74
  monitors:
    prometheusUrl: http://prometheus:9090
    servers:
      - name: Server
        enabled: true
        cpuQuery: cpu
        ramQuery: ram
`, "utf8");
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const scheduler = await Promise.race([
        startScheduler(env),
        new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 50))
      ]);

      expect(scheduler).not.toBe("timed-out");
      if (scheduler !== "timed-out") {
        scheduler.stop();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

async function createTestEnv(overrides: Partial<AppEnv> = {}): Promise<AppEnv> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-jobs-"));
  return {
    port: 0,
    configPath: path.join(dir, "homepage.yml"),
    cacheDir: path.join(dir, "cache"),
    staticDir: path.join(dir, "static"),
    ...overrides
  };
}
