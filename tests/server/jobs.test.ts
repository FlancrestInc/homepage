import { describe, expect, it, vi } from "vitest";
import { bookmarkHealthKey } from "../../src/server/cache/publicSnapshot";
import type { Bookmark } from "../../src/server/config/schema";
import { queryPrometheusRange } from "../../src/server/integrations/prometheus";
import { refreshHealthChecks } from "../../src/server/jobs/healthChecks";

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
});

describe("prometheus integration", () => {
  it("maps range query values into timestamp/value points", async () => {
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

    expect(points).toEqual([{ timestamp: "2026-05-11T11:20:00.000Z", value: 42.5 }]);
  });
});
