import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../../src/server/db/database";
import type { AppEnv } from "../../src/server/env";

async function envForDb() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "flancockpit-db-"));
  return { port: 0, configPath: path.join(dir, "homepage.yml"), cacheDir: path.join(dir, "cache"), staticDir: path.join(dir, "static"), dbPath: path.join(dir, "cockpit.db") } as AppEnv;
}

describe("cockpit sqlite state", () => {
  it("creates migrations and preserves instances/status across reopen", async () => {
    const env = await envForDb();
    const first = await openDatabase(env);
    first.saveInstance({ instanceId: "service:test", kind: "service", name: "Test", enabled: true, config: { url: "https://example.test" }, secretRefs: {} });
    first.saveStatus("service:test", { instanceId: "service:test", resourceId: "default", status: "healthy", checkedAt: "2026-01-01T00:00:00.000Z", lastSuccessAt: "2026-01-01T00:00:00.000Z", staleAt: "2026-01-01T01:00:00.000Z", freshness: "fresh", summary: "ok", fields: [], evidence: { password: "do-not-store", latencyMs: 4 } }, 0);
    expect(first.getInstance("service:test")?.enabled).toBe(true);
    expect(first.getStatus("service:test", "default")?.evidence).toEqual({ password: "[redacted]", latencyMs: 4 });
    first.close();

    const second = await openDatabase(env);
    expect(second.listInstances()).toHaveLength(1);
    expect(second.getFailureCount("service:test", "default")).toBe(0);
    second.close();
  });

  it("enforces idempotent action and notification keys", async () => {
    const env = await envForDb();
    const state = await openDatabase(env);
    state.saveInstance({ instanceId: "service:test", kind: "service", name: "Test" });
    const record = { actionId: "action-1", idempotencyScope: "user\\0service:test\\0default\\0refresh", idempotencyKey: "key-1", identity: "user", instanceId: "service:test", resourceId: "default", action: "refresh", status: "pending" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), configVersion: 1, requestFingerprint: "fingerprint" };
    state.createAction(record);
    expect(state.findActionByIdempotency(record.idempotencyScope, record.idempotencyKey)?.actionId).toBe("action-1");
    state.saveDelivery("notify:test", "event:test", "open", "sent");
    state.saveDelivery("notify:test", "event:test", "open", "sent");
    expect(state.getDelivery("notify:test", "event:test", "open")?.status).toBe("sent");
    state.close();
  });
});
