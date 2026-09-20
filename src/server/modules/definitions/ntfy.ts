import type { ModuleDefinition } from "../types.js";
import { sendNtfy } from "../../notifications/ntfy.js";

export const ntfyDefinition: ModuleDefinition = {
  kind: "notify.ntfy", name: "ntfy", category: "notifications", version: 1,
  setupSchema: { fields: [{ key: "serverUrl", label: "Server URL", type: "url", required: true }, { key: "topicRef", label: "Topic secret reference", type: "secretRef", required: true }] },
  secretFields: ["topicRef"],
  async testConnection(context, config, secretRefs) { const topic = await context.resolveSecret(secretRefs.topicRef ?? String(config.topicRef ?? "")); const serverUrl = String(config.serverUrl ?? "").replace(/\/$/, ""); const response = await context.request(`${serverUrl}/${encodeURIComponent(topic)}`, { method: "HEAD" }); return { ok: response.ok, message: response.ok ? "ntfy endpoint is reachable" : `ntfy returned HTTP ${response.status}` }; },
  async getStatus() { return { instanceId: "", status: "healthy" as const, resources: [] }; },
  actions: [{ id: "test_delivery", label: "Test delivery", execute: async (context) => { const serverUrl = String(context.config?.serverUrl ?? ""); const topic = await context.resolveSecret(context.secretRefs?.topicRef ?? ""); await sendNtfy(context, serverUrl, topic, "FlanCockpit test", "Notification delivery is configured correctly."); return { delivered: true }; } }]
};
