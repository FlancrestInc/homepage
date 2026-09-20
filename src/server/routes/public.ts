import type { FastifyInstance } from "fastify";
import path from "node:path";
import { readJsonCache } from "../cache/cacheStore.js";
import { buildBookmarkSnapshot, buildPublicSnapshot, buildWidgetSnapshot, type CachedHealth } from "../cache/publicSnapshot.js";
import { loadConfig } from "../config/store.js";
import type { AppEnv } from "../env.js";
import type { StateStore } from "../db/state.js";
import { ModuleRegistry } from "../modules/registry.js";
import { moduleSummary } from "../modules/catalog.js";

export async function registerPublicRoutes(app: FastifyInstance, env: AppEnv, cockpit?: { state: StateStore; registry: ModuleRegistry }) {
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
    return buildPublicSnapshot(config, { health, weather, monitors, modules: cockpit ? moduleSummary(cockpit.state, cockpit.registry) : [], attention: cockpit?.state.listActiveAttention() ?? [] });
  });

  app.get("/api/cockpit-snapshot", async () => ({ modules: cockpit ? moduleSummary(cockpit.state, cockpit.registry) : [], attention: cockpit?.state.listActiveAttention() ?? [], eventsSummary: { active: cockpit?.state.listActiveAttention().length ?? 0 }, generatedAt: new Date().toISOString() }));
}
