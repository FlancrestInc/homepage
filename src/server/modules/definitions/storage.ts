import type { ModuleDefinition, ModuleInstance, StatusResult } from "../types.js";
import { queryPrometheusValue } from "../../integrations/prometheus.js";
import { checkHttp } from "../transports/http.js";
import { runFixedSsh } from "../transports/ssh.js";
import { field, response, unknownResult } from "./helpers.js";

export const storageDefinition: ModuleDefinition = {
  kind: "storage", name: "Storage", category: "infrastructure", version: 1,
  setupSchema: { fields: [
    { key: "host", label: "Host", type: "text", required: true },
    { key: "mount", label: "Mount or share", type: "text", required: true },
    { key: "source", label: "Source", type: "select", required: true, options: ["http", "prometheus", "ssh"] },
    { key: "url", label: "Health URL", type: "url" },
    { key: "prometheusUrl", label: "Prometheus URL", type: "url" },
    { key: "capacityQuery", label: "Capacity query", type: "text" },
    { key: "freeQuery", label: "Free-space query", type: "text" },
    { key: "readWriteQuery", label: "Read/write query", type: "text" },
    { key: "sshAlias", label: "SSH allowlisted alias", type: "text" },
    { key: "directUrl", label: "Direct link", type: "url" }
  ] },
  secretFields: [],
  async testConnection(context, config) {
    const source = String(config.source ?? "http");
    if (source === "ssh") {
      const alias = requiredString(config.sshAlias, "ssh_alias_required");
      const mount = requiredString(config.mount, "mount_required");
      const result = await runFixedSsh({ alias, profile: "mount-state-readonly", timeoutMs: 5000 });
      const state = parseMountState(result.output, mount);
      return { ok: state.mounted, message: state.mounted ? "Mount is visible over SSH" : "Mount was not found", details: state.evidence };
    }
    if (source === "prometheus") {
      const baseUrl = requiredString(config.prometheusUrl, "prometheus_url_required");
      const queries = [config.capacityQuery, config.freeQuery].filter((value): value is string => typeof value === "string" && value.length > 0);
      if (!queries.length) return { ok: true, message: "Prometheus saved; add capacity and free-space queries for metrics" };
      await Promise.all(queries.map((query) => queryPrometheusValue({ baseUrl, query, timeoutMs: 5000 })));
      return { ok: true, message: "Prometheus storage queries succeeded" };
    }
    if (typeof config.url !== "string") return { ok: true, message: "Storage saved; configure a health URL for polling" };
    const check = await checkHttp(context, { url: config.url });
    return { ok: check.ok, message: check.ok ? `HTTP ${check.status}` : `Unexpected HTTP ${check.status}`, details: check.evidence };
  },
  async getStatus(context, instance) {
    try {
      const source = String(instance.config.source ?? "http");
      if (source === "ssh") return sshStatus(instance);
      if (source === "prometheus") return prometheusStatus(instance);
      return httpStatus(context, instance);
    } catch (error) {
      return response(instance, unknownResult(instance, "Storage check failed", error instanceof Error ? error.message : "Storage check failed", mountId(instance)));
    }
  },
  async getDetails(context, instance) { return (await storageDefinition.getStatus(context, instance)).resources[0] ?? null; },
  actions: [{ id: "refresh", label: "Refresh" }, { id: "retry", label: "Retry" }, { id: "acknowledge", label: "Acknowledge" }],
  conditions: [
    { id: "unavailable", severity: "critical", title: "Storage unavailable", when: (result) => result.status === "down", nextAction: { label: "Retry", action: "retry" } },
    { id: "read_only", severity: "warning", title: "Storage is read-only", when: (result) => result.fields.some((item) => item.key === "readWrite" && item.value === false), nextAction: { label: "Refresh", action: "refresh" } },
    { id: "capacity", severity: "warning", title: "Storage capacity is low", when: (result) => result.fields.some((item) => item.key === "freePercent" && typeof item.value === "number" && item.value < 10) },
    { id: "stale", severity: "warning", title: "Storage data is stale", when: (result) => result.freshness === "stale" }
  ],
  links: (instance) => typeof instance.config.directUrl === "string" ? [instance.config.directUrl] : []
};

function httpStatus(context: Parameters<ModuleDefinition["getStatus"]>[0], instance: ModuleInstance) {
  const url = typeof instance.config.url === "string" ? instance.config.url : undefined;
  if (!url) return response(instance, unknownResult(instance, "Configure a storage health URL", undefined, mountId(instance)));
  return checkHttp(context, { url }).then((check) => {
    const result: StatusResult = {
      instanceId: instance.instanceId,
      resourceId: mountId(instance),
      status: check.ok ? "healthy" : "down",
      checkedAt: new Date().toISOString(),
      lastSuccessAt: check.ok ? new Date().toISOString() : null,
      staleAt: null,
      freshness: check.ok ? "fresh" : "never_succeeded",
      summary: check.ok ? `Storage reachable in ${check.latencyMs} ms` : `HTTP ${check.status}`,
      fields: [field("mounted", check.ok ? "healthy" : "degraded", check.ok), field("readWrite", "unknown", null)],
      evidence: { ...check.evidence, mount: mountId(instance) }
    };
    return response(instance, result);
  });
}

async function prometheusStatus(instance: ModuleInstance) {
  const baseUrl = typeof instance.config.prometheusUrl === "string" ? instance.config.prometheusUrl : undefined;
  const capacityQuery = typeof instance.config.capacityQuery === "string" ? instance.config.capacityQuery : undefined;
  const freeQuery = typeof instance.config.freeQuery === "string" ? instance.config.freeQuery : undefined;
  const readWriteQuery = typeof instance.config.readWriteQuery === "string" ? instance.config.readWriteQuery : undefined;
  if (!baseUrl) return response(instance, unknownResult(instance, "Configure a Prometheus URL", undefined, mountId(instance)));
  const fields: StatusResult["fields"] = [];
  const evidence: StatusResult["evidence"] = { mount: mountId(instance), source: "prometheus" };
  const errors: string[] = [];
  const [capacity, free, readWrite] = await Promise.all([
    metric(baseUrl, capacityQuery, "capacity", instance.timeoutMs),
    metric(baseUrl, freeQuery, "free", instance.timeoutMs),
    metric(baseUrl, readWriteQuery, "readWrite", instance.timeoutMs)
  ]);
  if (capacity.value !== null) { fields.push(field("capacityBytes", "healthy", capacity.value)); evidence.capacityBytes = capacity.value; } else if (capacity.error) { fields.push(field("capacityBytes", "unknown", null, capacity.error)); errors.push(capacity.error); }
  if (free.value !== null) { fields.push(field("freeBytes", "healthy", free.value)); evidence.freeBytes = free.value; } else if (free.error) { fields.push(field("freeBytes", "unknown", null, free.error)); errors.push(free.error); }
  if (capacity.value !== null && free.value !== null && capacity.value > 0) { const freePercent = (free.value / capacity.value) * 100; fields.push(field("freePercent", freePercent < 10 ? "degraded" : "healthy", freePercent)); evidence.freePercent = freePercent; }
  if (readWrite.value !== null) { const writable = readWrite.value > 0; fields.push(field("readWrite", writable ? "healthy" : "degraded", writable)); evidence.readWrite = writable; } else fields.push(field("readWrite", "unknown", null, readWrite.error));
  const status = errors.length ? "degraded" : fields.some((item) => item.key === "readWrite" && item.value === false) ? "degraded" : fields.some((item) => item.key === "freePercent" && typeof item.value === "number" && item.value < 10) ? "degraded" : "healthy";
  return response(instance, { instanceId: instance.instanceId, resourceId: mountId(instance), status, checkedAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), staleAt: null, freshness: "fresh", summary: errors.length ? "Storage metrics are incomplete" : "Storage metrics collected", fields, evidence });
}

async function metric(baseUrl: string, query: string | undefined, label: string, timeoutMs: number) {
  if (!query) return { value: null, error: `${label}_query_missing` };
  try { return { value: await queryPrometheusValue({ baseUrl, query, timeoutMs }), error: undefined }; } catch { return { value: null, error: `${label}_query_failed` }; }
}

function sshStatus(instance: ModuleInstance) {
  const alias = requiredString(instance.config.sshAlias, "ssh_alias_required");
  return runFixedSsh({ alias, profile: "mount-state-readonly", timeoutMs: instance.timeoutMs }).then((result) => {
    const parsed = parseMountState(result.output, mountId(instance));
    const fields = [field("mounted", parsed.mounted ? "healthy" : "degraded", parsed.mounted), field("readWrite", parsed.mounted ? (parsed.readWrite ? "healthy" : "degraded") : "unknown", parsed.mounted ? parsed.readWrite : null)];
    const status = !parsed.mounted ? "down" : parsed.readWrite ? "healthy" : "degraded";
    return response(instance, { instanceId: instance.instanceId, resourceId: mountId(instance), status, checkedAt: new Date().toISOString(), lastSuccessAt: parsed.mounted ? new Date().toISOString() : null, staleAt: null, freshness: parsed.mounted ? "fresh" : "never_succeeded", summary: parsed.mounted ? (parsed.readWrite ? "Mounted read/write" : "Mounted read-only") : "Mount not found", fields, evidence: parsed.evidence });
  });
}

function parseMountState(output: string, mount: string) {
  const line = output.split("\n").map((item) => item.trim()).find((item) => item.split(/\s+/)[0] === mount);
  if (!line) return { mounted: false, readWrite: false, evidence: { mount, source: "ssh" } as Record<string, string | number | boolean | null> };
  const [target, filesystem, options = ""] = line.split(/\s+/);
  const readWrite = options.split(",").includes("rw");
  return { mounted: true, readWrite, evidence: { mount: target, filesystem, readWrite, source: "ssh" } as Record<string, string | number | boolean | null> };
}

function mountId(instance: ModuleInstance) { return typeof instance.config.mount === "string" && instance.config.mount ? instance.config.mount : "default"; }
function requiredString(value: unknown, error: string) { if (typeof value !== "string" || !value) throw new Error(error); return value; }
