import type { AppConfig } from "../config/schema.js";
import { queryGlancesCurrent } from "../integrations/glances.js";
import { type MetricPoint, queryPrometheusRange } from "../integrations/prometheus.js";

type FetchImpl = typeof fetch;
type MonitorsConfig = AppConfig["widgets"]["monitors"];

export type MonitorCard = {
  name: string;
  updatedAt: string;
  cpu: {
    current: number | null;
    history: MetricPoint[];
  };
  ram: {
    current: number | null;
    history: MetricPoint[];
  };
  error?: string;
};

export async function refreshMonitors(config: MonitorsConfig, fetchImpl: FetchImpl = fetch, previous: MonitorCard[] = [], timeoutMs = 10000): Promise<MonitorCard[]> {
  const now = new Date();
  const end = Math.floor(now.getTime() / 1000);
  const start = end - Math.floor(durationToMs(config.historyWindow) / 1000);
  const maxHistoryPoints = Math.max(1, Math.floor(durationToMs(config.historyWindow) / durationToMs(config.sampleInterval)) + 1);

  return Promise.all(
    config.servers
      .filter((server) => server.enabled)
      .map(async (server) => {
        const source = server.source ?? config.source;
        const updatedAt = new Date().toISOString();

        try {
          if (source === "glances") {
            if (!server.glancesUrl) {
              throw new Error("Glances URL is required");
            }
            const current = await queryGlancesCurrent({ baseUrl: server.glancesUrl, timeoutMs, fetchImpl });
            const previousCard = previous.find((card) => card.name === server.name);
            const cpuHistory = appendBoundedHistory(previousCard?.cpu.history ?? [], { timestamp: updatedAt, value: current.cpuPercent }, start, maxHistoryPoints);
            const ramHistory = appendBoundedHistory(previousCard?.ram.history ?? [], { timestamp: updatedAt, value: current.ramPercent }, start, maxHistoryPoints);
            return {
              name: server.name,
              updatedAt,
              cpu: { current: current.cpuPercent, history: cpuHistory },
              ram: { current: current.ramPercent, history: ramHistory }
            };
          }

          if (!config.prometheusUrl) {
            throw new Error("Prometheus URL is required");
          }
          if (!server.cpuQuery || !server.ramQuery) {
            throw new Error("CPU and RAM Prometheus queries are required");
          }

          const [cpuHistory, ramHistory] = await Promise.all([
            queryPrometheusRange({
              baseUrl: config.prometheusUrl,
              query: server.cpuQuery,
              start,
              end,
              step: config.sampleInterval,
              timeoutMs,
              fetchImpl
            }),
            queryPrometheusRange({
              baseUrl: config.prometheusUrl,
              query: server.ramQuery,
              start,
              end,
              step: config.sampleInterval,
              timeoutMs,
              fetchImpl
            })
          ]);

          return {
            name: server.name,
            updatedAt,
            cpu: { current: lastValue(cpuHistory), history: cpuHistory },
            ram: { current: lastValue(ramHistory), history: ramHistory }
          };
        } catch (error) {
          return {
            name: server.name,
            updatedAt,
            cpu: { current: null, history: [] },
            ram: { current: null, history: [] },
            error: error instanceof Error ? error.message : "Monitor refresh failed"
          };
        }
      })
  );
}

function lastValue(points: MetricPoint[]) {
  return points.at(-1)?.value ?? null;
}

function appendBoundedHistory(previous: MetricPoint[], next: MetricPoint, startSeconds: number, maxPoints: number) {
  const cutoffMs = startSeconds * 1000;
  return [...previous, next]
    .filter((point) => {
      const timestamp = Date.parse(point.timestamp);
      return Number.isFinite(timestamp) && timestamp >= cutoffMs && Number.isFinite(point.value);
    })
    .slice(-maxPoints);
}

function durationToMs(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  return amount * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 1);
}
