import type { FastifyInstance } from "fastify";
import path from "node:path";
import { readJsonCache } from "../cache/cacheStore.js";
import { buildBookmarkSnapshot, buildPublicSnapshot, buildWidgetSnapshot, type CachedHealth } from "../cache/publicSnapshot.js";
import { loadConfig } from "../config/store.js";
import type { AppEnv } from "../env.js";

export async function registerPublicRoutes(app: FastifyInstance, env: AppEnv) {
  app.get("/api/bookmarks-snapshot", async () => {
    const [config, health] = await Promise.all([
      loadConfig(env.configPath),
      readJsonCache<CachedHealth>(path.join(env.cacheDir, "health.json"), {})
    ]);
    return buildBookmarkSnapshot(config, health);
  });

  app.get("/api/widgets-snapshot", async () => {
    const [config, weather, monitors] = await Promise.all([
      loadConfig(env.configPath),
      readJsonCache<unknown>(path.join(env.cacheDir, "weather.json"), null),
      readJsonCache<unknown[]>(path.join(env.cacheDir, "monitors.json"), [])
    ]);
    return buildWidgetSnapshot(config, { weather, monitors });
  });

  app.get("/api/public-snapshot", async () => {
    const [config, health, weather, monitors] = await Promise.all([
      loadConfig(env.configPath),
      readJsonCache<CachedHealth>(path.join(env.cacheDir, "health.json"), {}),
      readJsonCache<unknown>(path.join(env.cacheDir, "weather.json"), null),
      readJsonCache<unknown[]>(path.join(env.cacheDir, "monitors.json"), [])
    ]);
    return buildPublicSnapshot(config, { health, weather, monitors });
  });
}
