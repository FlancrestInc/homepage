import type { ModuleDefinition, ModuleInstance, StatusResult } from "../types.js";
import { queryGlancesCurrent } from "../../integrations/glances.js";
import { queryPrometheusValue } from "../../integrations/prometheus.js";
import { checkHttp } from "../transports/http.js";
import { runFixedSsh } from "../transports/ssh.js";
import { field, response, unknownResult, urlConfig } from "./helpers.js";

export const hostDefinition: ModuleDefinition = {
  kind: "host", name: "Host", category: "infrastructure", version: 1,
  setupSchema: { fields: [
    { key: "name", label: "Host name", type: "text", required: true },
    { key: "source", label: "Metrics source", type: "select", options: ["http", "glances", "prometheus", "ssh"] },
    { key: "healthUrl", label: "Health URL", type: "url" },
    { key: "expectedStatuses", label: "Expected status codes", type: "text", placeholder: "200,204" },
    { key: "glancesUrl", label: "Glances URL", type: "url" },
    { key: "prometheusUrl", label: "Prometheus URL", type: "url" },
    { key: "cpuQuery", label: "CPU query", type: "text" },
    { key: "ramQuery", label: "RAM query", type: "text" },
    { key: "sshAlias", label: "SSH allowlisted alias", type: "text" },
    { key: "directUrl", label: "Direct link", type: "url" }
  ] },
  secretFields: [],
  async testConnection(context, config) {
    const source = String(config.source ?? "http");
    if (source === "ssh") {
      const alias = requiredString(config.sshAlias, "ssh_alias_required");
      await runFixedSsh({ alias, profile: "host-metrics-readonly", timeoutMs: 5000 });
      return { ok: true, message: "SSH host metrics command succeeded" };
    }
    if (source === "glances") {
      const baseUrl = requiredString(config.glancesUrl, "glances_url_required");
      const metrics = await queryGlancesCurrent({ baseUrl, timeoutMs: 5000 });
      return { ok: true, message: "Glances metrics query succeeded", details: { cpuPercent: metrics.cpuPercent, ramPercent: metrics.ramPercent } };
    }
    if (source === "prometheus") {
      const baseUrl = requiredString(config.prometheusUrl, "prometheus_url_required");
      const cpuQuery = requiredString(config.cpuQuery, "cpu_query_required");
      const ramQuery = requiredString(config.ramQuery, "ram_query_required");
      const [cpu, ram] = await Promise.all([queryPrometheusValue({ baseUrl, query: cpuQuery, timeoutMs: 5000 }), queryPrometheusValue({ baseUrl, query: ramQuery, timeoutMs: 5000 })]);
      return { ok: true, message: "Prometheus host metrics queries succeeded", details: { cpuPercent: cpu, ramPercent: ram } };
    }
    const url = urlConfig({ config } as never);
    if (!url) return { ok: true, message: "Host saved without an HTTP health endpoint" };
    const check = await checkHttp(context, { url });
    return { ok: check.ok, message: check.ok ? `HTTP ${check.status}` : `Unexpected HTTP ${check.status}`, details: check.evidence };
  },
  async getStatus(context, instance) {
    const source = String(instance.config.source ?? "http");
    if (source === "ssh") return sshStatus(instance);
    const url = urlConfig(instance);
    if (!url && source === "http") return response(instance, unknownResult(instance, "Configure a health URL or metrics source"));
    try {
      const check = url ? await checkHttp(context, { url, expectedStatuses: statuses(instance) }) : { ok: true, status: 200, latencyMs: 0, evidence: {} as Record<string, string | number | boolean | null> };
      const fields = [field("reachability", check.ok ? "healthy" : "degraded", check.ok), field("latencyMs", "healthy", check.latencyMs)];
      const evidence = { ...check.evidence } as Record<string, string | number | boolean | null>;
      let metricError: string | undefined;
      try {
        const metrics = await collectMetrics(context, instance, source);
        if (metrics) {
          fields.push(field("cpuPercent", "healthy", metrics.cpuPercent), field("ramPercent", "healthy", metrics.ramPercent));
          evidence.cpuPercent = metrics.cpuPercent;
          evidence.ramPercent = metrics.ramPercent;
        }
      } catch (error) {
        metricError = errorMessage(error);
        fields.push(field("metrics", "degraded", null, metricError));
      }
      const status = !check.ok ? "down" : metricError ? "degraded" : "healthy";
      return response(instance, { instanceId: instance.instanceId, resourceId: "default", status, checkedAt: new Date().toISOString(), lastSuccessAt: check.ok ? new Date().toISOString() : null, staleAt: null, freshness: check.ok ? "fresh" : "never_succeeded", summary: check.ok ? (metricError ? "Reachable; metrics unavailable" : `Reachable${url ? ` in ${check.latencyMs} ms` : ""}`) : `HTTP ${check.status}`, fields, evidence, ...(check.ok ? {} : { error: `HTTP ${check.status}` }) });
    } catch (error) {
      return response(instance, unknownResult(instance, "Host check failed", errorMessage(error)));
    }
  },
  async getDetails(context, instance) { return (await hostDefinition.getStatus(context, instance)).resources[0] ?? null; },
  actions: [{ id: "refresh", label: "Refresh" }, { id: "acknowledge", label: "Acknowledge" }],
  conditions: [{ id: "unreachable", severity: "critical", title: "Host unreachable", when: (result) => result.status === "down", nextAction: { label: "Refresh", action: "refresh" } }, { id: "stale", severity: "warning", title: "Host data is stale", when: (result) => result.freshness === "stale" }],
  links: (instance) => typeof instance.config.directUrl === "string" ? [instance.config.directUrl] : []
};

async function collectMetrics(context: Parameters<ModuleDefinition["getStatus"]>[0], instance: ModuleInstance, source: string) {
  if (source === "glances" && typeof instance.config.glancesUrl === "string") return queryGlancesCurrent({ baseUrl: instance.config.glancesUrl, timeoutMs: instance.timeoutMs, fetchImpl: context.request as typeof fetch });
  if (source === "prometheus" && typeof instance.config.prometheusUrl === "string" && typeof instance.config.cpuQuery === "string" && typeof instance.config.ramQuery === "string") {
    const [cpuPercent, ramPercent] = await Promise.all([
      queryPrometheusValue({ baseUrl: instance.config.prometheusUrl, query: instance.config.cpuQuery, timeoutMs: instance.timeoutMs, fetchImpl: context.request as typeof fetch }),
      queryPrometheusValue({ baseUrl: instance.config.prometheusUrl, query: instance.config.ramQuery, timeoutMs: instance.timeoutMs, fetchImpl: context.request as typeof fetch })
    ]);
    return { cpuPercent, ramPercent };
  }
  if (source === "http") return undefined;
  throw new Error("metrics_source_incomplete");
}

function sshStatus(instance: ModuleInstance) {
  try {
    const alias = requiredString(instance.config.sshAlias, "ssh_alias_required");
    return runFixedSsh({ alias, profile: "host-metrics-readonly", timeoutMs: instance.timeoutMs }).then((result) => {
      const evidence = parseSshEvidence(result.output);
      const status: StatusResult = { instanceId: instance.instanceId, resourceId: "default", status: "healthy", checkedAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), staleAt: null, freshness: "fresh", summary: "SSH host metrics collected", fields: [field("reachability", "healthy", true)], evidence };
      return response(instance, status);
    });
  } catch (error) {
    return Promise.resolve(response(instance, unknownResult(instance, "Host SSH check failed", errorMessage(error))));
  }
}

function parseSshEvidence(output: string) {
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  return { kernel: lines[0]?.slice(0, 120) ?? null, uptime: lines[1]?.replace(/\s+/g, " ").slice(0, 160) ?? null, source: "ssh" } as Record<string, string | number | boolean | null>;
}
function statuses(instance: { config: Record<string, unknown> }) { return Array.isArray(instance.config.expectedStatuses) ? instance.config.expectedStatuses.map(Number) : undefined; }
function requiredString(value: unknown, error: string) { if (typeof value !== "string" || !value) throw new Error(error); return value; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Host check failed"; }
