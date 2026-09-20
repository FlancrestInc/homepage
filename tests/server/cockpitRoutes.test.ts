import type { FastifyInstance } from "fastify";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/index";
import type { AppEnv } from "../../src/server/env";

async function withApp(callback: (app: FastifyInstance) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "flancockpit-routes-"));
  const env = { port: 0, configPath: path.join(dir, "homepage.yml"), cacheDir: path.join(dir, "cache"), staticDir: path.join(dir, "static"), dbPath: path.join(dir, "cockpit.db") } as AppEnv;
  const app = await buildApp(env, { startJobs: false, serveStatic: false });
  try { await callback(app); } finally { await app.close(); }
}

describe("cockpit routes", () => {
  it("exposes the seeded v1 catalog and empty healthy snapshot", async () => {
    await withApp(async (app) => {
      const modules = await app.inject({ method: "GET", url: "/api/modules" });
      expect(modules.statusCode).toBe(200);
      expect(modules.json()).toHaveLength(6);
      expect(modules.json().flatMap((item: { instances: unknown[] }) => item.instances)).toHaveLength(19);
      const cockpit = await app.inject({ method: "GET", url: "/api/cockpit-snapshot" });
      expect(cockpit.statusCode).toBe(200);
      expect(cockpit.json().attention).toEqual([]);
    });
  });

  it("rejects state-changing module writes without trusted identity", async () => {
    await withApp(async (app) => {
      const response = await app.inject({ method: "POST", url: "/api/modules", payload: { kind: "service", instanceId: "service:test", config: {}, secretRefs: {}, testId: "missing" } });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    });
  });
});
