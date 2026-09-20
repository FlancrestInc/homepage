import type { JsonValue } from "../../security/redaction.js";
import type { ConnectorContext, ModuleInstance, ModuleStatusResponse, StatusResult } from "../types.js";

export function unknownResult(instance: ModuleInstance, summary: string, error?: string, resourceId = "default"): StatusResult {
  return { instanceId: instance.instanceId, resourceId, status: "unknown", checkedAt: new Date().toISOString(), lastSuccessAt: null, staleAt: null, freshness: "never_succeeded", summary, fields: [], evidence: {}, ...(error ? { error } : {}) };
}

export function response(instance: ModuleInstance, result: StatusResult): ModuleStatusResponse { return { instanceId: instance.instanceId, status: result.status, resources: [result] }; }
export function field(key: string, status: "healthy" | "degraded" | "unknown", value: JsonValue, error?: string) { return { key, status, value, ...(error ? { error } : {}) }; }
export function urlConfig(instance: ModuleInstance, keys = ["healthUrl", "url", "baseUrl"]) { for (const key of keys) { const value = instance.config[key]; if (typeof value === "string" && value) return value; } return undefined; }
export function noOpTest(_context: ConnectorContext) { return Promise.resolve({ ok: true, message: "Configured without a network endpoint" }); }
