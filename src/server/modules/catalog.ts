import type { StateStore } from "../db/state.js";
import { ModuleRegistry } from "./registry.js";
import { hostDefinition } from "./definitions/host.js";
import { storageDefinition } from "./definitions/storage.js";
import { serviceDefinition } from "./definitions/service.js";
import { publicRouteDefinition } from "./definitions/publicRoute.js";
import { ntfyDefinition } from "./definitions/ntfy.js";
import { appriseDefinition } from "./definitions/apprise.js";

export function createCoreRegistry() {
  const registry = new ModuleRegistry();
  for (const definition of [hostDefinition, storageDefinition, serviceDefinition, publicRouteDefinition, ntfyDefinition, appriseDefinition]) registry.register(definition);
  return registry;
}

export function seedV1Instances(state: StateStore) {
  const entries: Array<[string, string, string]> = [
    ["host:gospel", "host", "Gospel"], ["host:barnabas", "host", "Barnabas"], ["host:mettool", "host", "Mettool"], ["host:bubblecrab", "host", "Bubblecrab"], ["host:stormeagle", "host", "Stormeagle"], ["host:frostwalrus", "host", "Frostwalrus"],
    ["storage:eddy", "storage", "Eddy"], ["storage:barnabas", "storage", "Barnabas storage"],
    ["service:hermes", "service", "Hermes"], ["service:flancommand", "service", "FlanCommand"], ["service:disc-steward", "service", "Disc Steward"], ["service:workspace", "service", "Workspace"], ["service:jellyfin", "service", "Jellyfin"], ["service:paperless", "service", "Paperless"], ["service:frigate", "service", "Frigate"], ["service:open-webui", "service", "Open WebUI"], ["service:home-assistant", "service", "Home Assistant"],
    ["notify:ntfy", "notify.ntfy", "ntfy"], ["notify:apprise", "notify.apprise", "Apprise"]
  ];
  for (const [instanceId, kind, name] of entries) if (!state.getInstance(instanceId)) state.saveInstance({ instanceId, kind, name, enabled: false, config: {}, secretRefs: {} });
}

export function moduleSummary(state: StateStore, registry: ModuleRegistry) {
  return state.listInstances().map((instance) => ({ instanceId: instance.instanceId, kind: instance.kind, name: instance.name, enabled: instance.enabled, status: aggregate(state.getStatuses(instance.instanceId)), statuses: state.getStatuses(instance.instanceId), links: registry.get(instance.kind)?.links?.(instance, "default") ?? [] }));
}

function aggregate(results: Array<{ status: string }>) { if (results.some((item) => item.status === "down")) return "down"; if (results.some((item) => item.status === "degraded")) return "degraded"; if (results.some((item) => item.status === "healthy")) return "healthy"; return "unknown"; }
