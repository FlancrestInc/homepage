import type { FastifyInstance } from "fastify";
import path from "node:path";
import { readJsonCache } from "../cache/cacheStore.js";
import { buildPublicSnapshot, type CachedHealth } from "../cache/publicSnapshot.js";
import { loadConfig } from "../config/store.js";
import type { AppEnv } from "../env.js";

export async function registerPublicRoutes(app: FastifyInstance, env: AppEnv) {
  app.get("/api/public-snapshot", async () => {
    const config = await loadConfig(env.configPath);
    const health = await readJsonCache<CachedHealth>(path.join(env.cacheDir, "health.json"), {});
    const weather = await readJsonCache<unknown>(path.join(env.cacheDir, "weather.json"), null);
    const monitors = await readJsonCache<unknown[]>(path.join(env.cacheDir, "monitors.json"), []);
    return buildPublicSnapshot(config, { health, weather, monitors });
  });
}
