import type { ModuleDefinition } from "../types.js";
import { sendApprise } from "../../notifications/apprise.js";

export const appriseDefinition: ModuleDefinition = {
  kind: "notify.apprise", name: "Apprise", category: "notifications", version: 1,
  setupSchema: { fields: [{ key: "endpointUrlRef", label: "Apprise endpoint secret reference", type: "secretRef", required: true }] },
  secretFields: ["endpointUrlRef"],
  async testConnection(context, _config, secretRefs) { const endpoint = await context.resolveSecret(secretRefs.endpointUrlRef ?? ""); const response = await context.request(endpoint, { method: "HEAD" }); return { ok: response.ok, message: response.ok ? "Apprise endpoint is reachable" : `Apprise returned HTTP ${response.status}` }; },
  async getStatus() { return { instanceId: "", status: "healthy" as const, resources: [] }; },
  actions: [{ id: "test_delivery", label: "Test delivery", execute: async (context) => { const endpoint = await context.resolveSecret(context.secretRefs?.endpointUrlRef ?? ""); await sendApprise(context, endpoint, "FlanCockpit test", "Notification delivery is configured correctly."); return { delivered: true }; } }]
};
