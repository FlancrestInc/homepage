import type { FastifyInstance } from "fastify";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/server/env";
import { buildApp } from "../../src/server/index";

async function createTestEnv(overrides: Partial<AppEnv> = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-routes-"));
  return {
    port: 0,
    configPath: path.join(dir, "homepage.yml"),
    cacheDir: path.join(dir, "cache"),
    staticDir: path.join(dir, "static"),
    ...overrides
  };
}

async function withTestApp<T>(
  callback: (app: FastifyInstance, env: AppEnv) => Promise<T>,
  options: { env?: Partial<AppEnv>; serveStatic?: boolean } = {}
) {
  const env = await createTestEnv(options.env);
  const app = await buildApp(env, { serveStatic: options.serveStatic ?? false, startJobs: false });
  try {
    return await callback(app, env);
  } finally {
    await app.close();
  }
}

describe("routes", () => {
  it("returns a public snapshot with empty groups for missing config and cache", async () => {
    await withTestApp(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/public-snapshot" });

      expect(response.statusCode).toBe(200);
      expect(response.json().groups).toEqual([]);
    });
  });

  it("serves bookmarks independently from widget caches", async () => {
    await withTestApp(async (app) => {
      const bookmarkResponse = await app.inject({ method: "GET", url: "/api/bookmarks-snapshot" });
      const widgetResponse = await app.inject({ method: "GET", url: "/api/widgets-snapshot" });

      expect(bookmarkResponse.statusCode).toBe(200);
      expect(bookmarkResponse.json().groups).toEqual([]);
      expect(bookmarkResponse.json().widgets).toBeUndefined();
      expect(widgetResponse.statusCode).toBe(200);
      expect(widgetResponse.json().widgets).toBeDefined();
      expect(widgetResponse.json().groups).toBeUndefined();
    });
  });

  it("saves valid config through the config API", async () => {
    await withTestApp(async (app) => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/config",
        payload: { bookmarks: [{ name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com" }] }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().bookmarks[0].name).toBe("GitHub");
    });
  });

  it("rejects invalid config through the config API", async () => {
    await withTestApp(async (app) => {
      const response = await app.inject({ method: "PUT", url: "/api/config", payload: { theme: { mode: "sepia" } } });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("invalid_config");
    });
  });

  it("rejects invalid config loaded through the config API", async () => {
    await withTestApp(async (app, env) => {
      await writeFile(env.configPath, "theme:\n  mode: sepia\n", "utf8");

      const response = await app.inject({ method: "GET", url: "/api/config" });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("invalid_config");
      expect(response.json().issues.length).toBeGreaterThan(0);
    });
  });

  it("protects the app with optional HTTP Basic authentication", async () => {
    await withTestApp(async (app) => {
      const healthResponse = await app.inject({ method: "GET", url: "/api/health" });
      const unauthorizedResponse = await app.inject({ method: "GET", url: "/api/public-snapshot" });
      const authorizedResponse = await app.inject({
        method: "GET",
        url: "/api/public-snapshot",
        headers: { authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}` }
      });

      expect(healthResponse.statusCode).toBe(200);
      expect(unauthorizedResponse.statusCode).toBe(401);
      expect(unauthorizedResponse.headers["www-authenticate"]).toContain("Basic");
      expect(authorizedResponse.statusCode).toBe(200);
    }, { env: { basicAuth: { username: "admin", password: "secret" } } });
  });

  it("serves JSON 404s for API routes and index HTML for SPA routes", async () => {
    const staticDir = path.join(await mkdtemp(path.join(os.tmpdir(), "homepage-static-")), "client");
    await mkdir(staticDir, { recursive: true });
    await writeFile(path.join(staticDir, "index.html"), "<!doctype html><h1>Homepage</h1>", "utf8");
    await mkdir(path.join(staticDir, "assets"), { recursive: true });
    await writeFile(path.join(staticDir, "assets", "app.js"), "console.log('app');", "utf8");

    await withTestApp(async (app) => {
      const apiResponse = await app.inject({ method: "GET", url: "/api/nope" });
      const spaResponse = await app.inject({ method: "GET", url: "/deep/link" });
      const indexResponse = await app.inject({ method: "GET", url: "/index.html" });
      const assetResponse = await app.inject({ method: "GET", url: "/assets/app.js" });

      expect(apiResponse.statusCode).toBe(404);
      expect(apiResponse.json()).toEqual({ error: "not_found" });
      expect(spaResponse.statusCode).toBe(200);
      expect(spaResponse.headers["content-type"]).toContain("text/html");
      expect(spaResponse.body).toContain("<h1>Homepage</h1>");
      expect(indexResponse.headers["cache-control"]).toBe("no-cache");
      expect(assetResponse.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    }, { env: { staticDir }, serveStatic: true });
  });
});
