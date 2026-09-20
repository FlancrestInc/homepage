import type { ModuleDefinition } from "../types.js";
import { checkHttp, checkTlsCertificate } from "../transports/http.js";
import { field, response, unknownResult } from "./helpers.js";
import type { JsonValue } from "../types.js";

export const publicRouteDefinition: ModuleDefinition = {
  kind: "route.public", name: "Public route", category: "network", version: 1,
  setupSchema: { fields: [{ key: "url", label: "Public URL", type: "url", required: true }, { key: "expectedStatuses", label: "Expected status codes", type: "text", placeholder: "200" }, { key: "certificateCheck", label: "Check TLS certificate", type: "boolean" }, { key: "certificateWarningDays", label: "Certificate warning days", type: "number", placeholder: "30" }] },
  secretFields: [],
  async testConnection(context, config) { if (typeof config.url !== "string") throw new Error("url_required"); const check = await checkHttp(context, { url: config.url }); const certificate = await certificateStatus(context, config.url, config); return { ok: check.ok && !certificate.error, message: certificate.error ?? (check.ok ? `HTTP ${check.status}` : `Unexpected HTTP ${check.status}`), details: { ...check.evidence, ...certificate.evidence } }; },
  async getStatus(context, instance) { const url = typeof instance.config.url === "string" ? instance.config.url : undefined; if (!url) return response(instance, unknownResult(instance, "Configure a public URL")); try { const check = await checkHttp(context, { url, expectedStatuses: expected(instance) }); const certificate = await certificateStatus(context, url, instance.config); const warningDays = numberValue(instance.config.certificateWarningDays, 30); const certificateWarning = certificate.checked && (certificate.expired || (certificate.daysRemaining ?? Number.MAX_SAFE_INTEGER) <= warningDays); const certificateProblem = Boolean(certificate.error) || certificateWarning; const fields = [field("statusCode", check.ok ? "healthy" : "degraded", check.status), field("latencyMs", "healthy", check.latencyMs)]; if (certificate.checked || certificate.error) fields.push(field("tlsDaysRemaining", certificateProblem ? "degraded" : "healthy", certificate.daysRemaining, certificate.error)); const evidence = { ...check.evidence, ...certificate.evidence }; return response(instance, { instanceId: instance.instanceId, resourceId: "default", status: !check.ok ? "down" : certificateProblem ? "degraded" : "healthy", checkedAt: new Date().toISOString(), lastSuccessAt: check.ok ? new Date().toISOString() : null, staleAt: null, freshness: check.ok ? "fresh" : "never_succeeded", summary: !check.ok ? `HTTP ${check.status}` : certificate.error ? "Reachable; TLS certificate unavailable" : certificateWarning ? `Reachable; certificate expires in ${certificate.daysRemaining} days` : `HTTP ${check.status} in ${check.latencyMs} ms`, fields, evidence }); } catch (error) { return response(instance, unknownResult(instance, "Public route check failed", error instanceof Error ? error.message : "Route check failed")); } },
  async getDetails(context, instance) { return (await publicRouteDefinition.getStatus(context, instance)).resources[0] ?? null; },
  actions: [{ id: "refresh", label: "Refresh" }, { id: "acknowledge", label: "Acknowledge" }],
  conditions: [{ id: "route_failure", severity: "critical", title: "Public route failed", when: (result) => result.status === "down", nextAction: { label: "Refresh", action: "refresh" } }, { id: "certificate_warning", severity: "warning", title: "Public route certificate needs attention", when: (result) => result.fields.some((item) => item.key === "tlsDaysRemaining" && item.status === "degraded") }, { id: "stale", severity: "warning", title: "Public route data is stale", when: (result) => result.freshness === "stale" }],
  links: (instance) => typeof instance.config.url === "string" ? [instance.config.url] : []
};

function expected(instance: { config: Record<string, unknown> }) { const value = instance.config.expectedStatuses; if (Array.isArray(value)) return value.map(Number); if (typeof value === "string") return value.split(",").map(Number).filter(Number.isFinite); return [200, 204, 301, 302, 304]; }
type CertificateStatus = { checked: boolean; validTo: string | null; daysRemaining: number | null; expired: boolean; error?: string; evidence: Record<string, JsonValue> };

async function certificateStatus(context: Parameters<ModuleDefinition["testConnection"]>[0], url: string, config: Record<string, unknown>): Promise<CertificateStatus> {
  if (config.certificateCheck === false) return { checked: false, validTo: null, daysRemaining: null, expired: false, error: undefined, evidence: {} as Record<string, string | number | boolean | null> };
  try {
    const certificate = await checkTlsCertificate(context, url);
    return { ...certificate, error: undefined, evidence: certificate.checked ? { tlsValidTo: certificate.validTo, tlsDaysRemaining: certificate.daysRemaining, tlsExpired: certificate.expired } : {} };
  } catch (error) {
    return { checked: true, validTo: null, daysRemaining: null, expired: false, error: error instanceof Error ? error.message : "TLS certificate check failed", evidence: { tlsError: "certificate_check_failed" } };
  }
}
function numberValue(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.min(3650, parsed)) : fallback; }
