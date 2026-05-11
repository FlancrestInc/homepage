import path from "node:path";
import { readJsonCache, writeJsonCache } from "../cache/cacheStore.js";
import { loadConfig } from "../config/store.js";
import type { AppEnv } from "../env.js";
import { refreshHealthChecks } from "./healthChecks.js";
import { type MonitorCard, refreshMonitors } from "./monitors.js";
import { refreshWeather } from "./weather.js";

export type SchedulerHandle = {
  stop: () => void;
};

export function durationToMs(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 1);
}

export async function startScheduler(env: AppEnv): Promise<SchedulerHandle> {
  const config = await loadConfig(env.configPath);
  const intervals: NodeJS.Timeout[] = [];
  const healthRunner = createNoOverlapRunner(() => runHealthChecks(env));
  const weatherRunner = createNoOverlapRunner(() => runWeather(env));
  const monitorsRunner = createNoOverlapRunner(() => runMonitors(env));

  healthRunner();
  weatherRunner();
  monitorsRunner();

  intervals.push(setInterval(healthRunner, durationToMs(config.healthChecks.defaultInterval)));
  intervals.push(setInterval(weatherRunner, durationToMs(config.widgets.weather.refreshInterval)));
  intervals.push(setInterval(monitorsRunner, durationToMs(config.widgets.monitors.refreshInterval)));

  return {
    stop: () => {
      for (const interval of intervals) {
        clearInterval(interval);
      }
    }
  };
}

export function createNoOverlapRunner(job: () => Promise<void>): () => void {
  let running = false;
  return () => {
    if (running) {
      return;
    }
    running = true;
    void job()
      .catch((error) => {
        reportJobError("scheduled job", error);
      })
      .finally(() => {
        running = false;
      });
  };
}

async function runHealthChecks(env: AppEnv) {
  try {
    const config = await loadConfig(env.configPath);
    const health = await refreshHealthChecks({
      bookmarks: config.bookmarks,
      timeout: durationToMs(config.healthChecks.timeout)
    });
    await writeJsonCache(path.join(env.cacheDir, "health.json"), health);
  } catch (error) {
    reportJobError("health checks", error);
  }
}

async function runWeather(env: AppEnv) {
  try {
    const config = await loadConfig(env.configPath);
    const weather = await refreshWeather(config.widgets.weather);
    await writeJsonCache(path.join(env.cacheDir, "weather.json"), weather);
  } catch (error) {
    reportJobError("weather", error);
  }
}

async function runMonitors(env: AppEnv) {
  try {
    const config = await loadConfig(env.configPath);
    const previous = await readJsonCache<MonitorCard[]>(path.join(env.cacheDir, "monitors.json"), []);
    const monitors = await refreshMonitors(config.widgets.monitors, fetch, previous);
    await writeJsonCache(path.join(env.cacheDir, "monitors.json"), monitors);
  } catch (error) {
    reportJobError("monitors", error);
  }
}

function reportJobError(job: string, error: unknown) {
  console.error(`Failed to refresh ${job}:`, error);
}
