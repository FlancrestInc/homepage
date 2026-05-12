import type { FastifyInstance } from "fastify";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/server/env";
import { buildApp } from "../../src/server/index";

async function createTestEnv(overrides: Partial<AppEnv> = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-icons-"));
  return {
    port: 0,
    configPath: path.join(dir, "homepage.yml"),
    cacheDir: path.join(dir, "cache"),
    staticDir: path.join(dir, "static"),
    ...overrides
  };
}

async function withTestApp<T>(callback: (app: FastifyInstance) => Promise<T>) {
  const env = await createTestEnv();
  const app = await buildApp(env, { serveStatic: false, startJobs: false });
  try {
    return await callback(app);
  } finally {
    await app.close();
  }
}

describe("icon routes", () => {
  it("returns no icons for empty searches", async () => {
    await withTestApp(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/icons?q=" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ icons: [] });
    });
  });

  it("returns Simple Icons and MDI-style matches for icon search", async () => {
    await withTestApp(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/icons?q=grafana" });
      const mdiResponse = await app.inject({ method: "GET", url: "/api/icons?q=github" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(
        expect.objectContaining({
          icons: expect.arrayContaining([
            expect.objectContaining({
              name: "Grafana",
              value: "si-grafana",
              source: "simple-icons"
            })
          ])
        })
      );

      const icons = response.json().icons as Array<{ name?: unknown; value?: unknown; source?: unknown }>;
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of icons) {
        expect(icon).toEqual({
          name: expect.any(String),
          value: expect.any(String),
          source: expect.stringMatching(/^(simple-icons|mdi)$/)
        });
      }

      expect(mdiResponse.statusCode).toBe(200);
      expect(mdiResponse.json().icons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "GitHub", value: "si-github", source: "simple-icons" }),
          expect.objectContaining({ name: "GitHub", value: "mdi-github", source: "mdi" })
        ])
      );
    });
  });

  it("uses the first search term when duplicate query parameters are provided", async () => {
    await withTestApp(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/icons?q=grafana&q=github" });

      expect(response.statusCode).toBe(200);
      expect(response.json().icons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Grafana",
            value: "si-grafana",
            source: "simple-icons"
          })
        ])
      );
    });
  });

  it("limits icon search results", async () => {
    await withTestApp(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/icons?q=a" });

      expect(response.statusCode).toBe(200);
      expect(response.json().icons).toHaveLength(36);
    });
  });
});
