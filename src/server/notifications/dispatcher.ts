import type { StateStore } from "../db/state.js";
import type { AppEnv } from "../env.js";
import type { AttentionEvent, ModuleInstance } from "../modules/types.js";
import { resolveSecret } from "../security/secrets.js";
import { sendNtfy } from "./ntfy.js";
import { sendApprise } from "./apprise.js";

export class NotificationDispatcher {
  constructor(private readonly state: StateStore, private readonly env: AppEnv) {}

  async notify(event: AttentionEvent, phase: "open" | "reminder" | "recovered", transports: ModuleInstance[]) {
    for (const transport of transports.filter((item) => item.enabled)) {
      const previous = this.state.getDelivery(transport.instanceId, event.eventId, phase);
      if (previous?.status === "sent" && (phase !== "reminder" || !previous.sentAt || Date.parse(previous.sentAt) + 6 * 60 * 60_000 > Date.now())) continue;
      const context = { instanceId: transport.instanceId, signal: new AbortController().signal, now: new Date(), resolveSecret: (reference: string) => resolveSecret(reference, this.env), request: (input: string | URL | Request, init?: RequestInit) => fetch(input, init) };
      try {
        const message = `${event.summary}\nAge: ${formatAge(event.openedAt)}\nResource: ${event.resourceId}`;
        if (transport.kind === "notify.ntfy") await sendNtfy(context, String(transport.config.serverUrl), await context.resolveSecret(transport.secretRefs.topicRef), event.title, message);
        else if (transport.kind === "notify.apprise") await sendApprise(context, await context.resolveSecret(transport.secretRefs.endpointUrlRef), event.title, message);
        this.state.saveDelivery(transport.instanceId, event.eventId, phase, "sent");
      } catch (error) {
        this.state.saveDelivery(transport.instanceId, event.eventId, phase, "failed", error instanceof Error ? error.message : "Delivery failed");
      }
    }
  }

  async remind(events: AttentionEvent[], transports: ModuleInstance[]) {
    for (const event of events) {
      if (Date.parse(event.openedAt) + 60 * 60_000 <= Date.now()) await this.notify(event, "reminder", transports);
    }
  }
}

function formatAge(openedAt: string) { return `${Math.max(0, Math.round((Date.now() - Date.parse(openedAt)) / 60000))}m`; }
