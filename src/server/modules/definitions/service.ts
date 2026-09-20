import type { ModuleDefinition } from "../types.js";
import { checkHttp } from "../transports/http.js";
import { field, response, unknownResult, urlConfig } from "./helpers.js";

export const serviceDefinition: ModuleDefinition = {
  kind: "service", name: "Service", category: "services", version: 1,
  setupSchema: { fields: [{ key: "baseUrl", label: "Base URL", type: "url", required: true }, { key: "healthUrl", label: "Health URL", type: "url" }, { key: "directUrl", label: "Direct link", type: "url" }, { key: "expectedStatuses", label: "Expected status codes", type: "text", placeholder: "200,204" }] },
  secretFields: [],
  async testConnection(context, config) { const url = typeof config.healthUrl === "string" ? config.healthUrl : typeof config.baseUrl === "string" ? config.baseUrl : undefined; if (!url) throw new Error("health_url_required"); const check = await checkHttp(context, { url }); return { ok: check.ok, message: check.ok ? `HTTP ${check.status}` : `Unexpected HTTP ${check.status}`, details: check.evidence }; },
  async getStatus(context, instance) { const url = urlConfig(instance, ["healthUrl", "baseUrl"]); if (!url) return response(instance, unknownResult(instance, "Configure a service URL")); try { const check = await checkHttp(context, { url, expectedStatuses: expected(instance) }); const ok = check.ok; return response(instance, { instanceId: instance.instanceId, resourceId: "default", status: ok ? "healthy" : "down", checkedAt: new Date().toISOString(), lastSuccessAt: ok ? new Date().toISOString() : null, staleAt: null, freshness: ok ? "fresh" : "never_succeeded", summary: ok ? `Healthy in ${check.latencyMs} ms` : `HTTP ${check.status}`, fields: [field("health", ok ? "healthy" : "degraded", ok), field("latencyMs", "healthy", check.latencyMs)], evidence: check.evidence, ...(ok ? {} : { error: `HTTP ${check.status}` }) }); } catch (error) { return response(instance, unknownResult(instance, "Service check failed", errorMessage(error))); } },
  async getDetails(context, instance) { return (await serviceDefinition.getStatus(context, instance)).resources[0] ?? null; },
  actions: [{ id: "refresh", label: "Refresh" }, { id: "retry", label: "Retry" }, { id: "acknowledge", label: "Acknowledge" }],
  conditions: [{ id: "health_failure", severity: "critical", title: "Service health check failed", when: (result) => result.status !== "healthy", nextAction: { label: "Retry", action: "retry" } }, { id: "stale", severity: "warning", title: "Service status is stale", when: (result) => result.freshness === "stale" }],
  links: (instance) => [instance.config.directUrl, instance.config.baseUrl].filter((value): value is string => typeof value === "string" && value.length > 0)
};

function expected(instance: { config: Record<string, unknown> }) { const value = instance.config.expectedStatuses; if (Array.isArray(value)) return value.map(Number); if (typeof value === "string") return value.split(",").map(Number).filter(Number.isFinite); return undefined; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Service check failed"; }
