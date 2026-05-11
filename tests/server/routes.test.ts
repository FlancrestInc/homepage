import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/index";

async function createTestApp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-routes-"));
  return buildApp({
    port: 0,
    configPath: path.join(dir, "homepage.yml"),
    cacheDir: path.join(dir, "cache"),
    staticDir: path.resolve("dist/client")
  }, { serveStatic: false, startJobs: false });
}

describe("routes", () => {
  it("returns a public snapshot with empty groups for missing config and cache", async () => {
    const app = await createTestApp();

    const response = await app.inject({ method: "GET", url: "/api/public-snapshot" });

    expect(response.statusCode).toBe(200);
    expect(response.json().groups).toEqual([]);
  });

  it("saves valid config through the config API", async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: "PUT",
      url: "/api/config",
      payload: { bookmarks: [{ name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com" }] }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().bookmarks[0].name).toBe("GitHub");
  });

  it("rejects invalid config through the config API", async () => {
    const app = await createTestApp();

    const response = await app.inject({ method: "PUT", url: "/api/config", payload: { theme: { mode: "sepia" } } });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_config");
  });
});
