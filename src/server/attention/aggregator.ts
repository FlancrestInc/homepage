import { randomUUID } from "node:crypto";
import type { StateStore } from "../db/state.js";
import { redactForPersistence } from "../security/redaction.js";
import type { ModuleDefinition, AttentionEvent, StatusResult } from "../modules/types.js";
import { conditionsFor } from "./definitions.js";

export type AttentionAggregatorOptions = { onTransition?: (event: AttentionEvent, phase: "open" | "reminder" | "recovered") => Promise<void> | void };

export class AttentionAggregator {
  constructor(private readonly state: StateStore, private readonly options: AttentionAggregatorOptions = {}) {}

  async onStatus(result: StatusResult, definition?: ModuleDefinition) {
    const failed = result.status === "down" || result.status === "unknown" || result.freshness === "stale";
    const count = failed ? this.state.getFailureCount(result.instanceId, result.resourceId) : 0;
    const conditions = conditionsFor(result, definition?.conditions);
    for (const condition of conditions) {
      const eventKey = `${result.instanceId}\0${result.resourceId}\0${condition.id}`;
      const current = this.state.getOpenEvent(eventKey);
      if (!current && count >= 2 && result.lastSuccessAt) {
        const event = redactForPersistence({ eventId: randomUUID(), eventKey, instanceId: result.instanceId, resourceId: result.resourceId, conditionId: condition.id, severity: condition.severity, state: "open", title: condition.title, summary: condition.summary, evidence: result.evidence, openedAt: result.checkedAt, lastSeenAt: result.checkedAt, nextAction: condition.nextAction }) as AttentionEvent;
        this.state.upsertEvent(event);
        await this.options.onTransition?.(event, "open");
      } else if (current) {
        this.state.upsertEvent(redactForPersistence({ ...current, lastSeenAt: result.checkedAt, summary: condition.summary, evidence: result.evidence }) as AttentionEvent);
      }
    }
    if (!failed) {
      for (const event of this.state.listEvents(500).filter((item) => item.instanceId === result.instanceId && item.resourceId === result.resourceId && item.state !== "recovered")) {
        const stillOpen = conditions.some((condition) => condition.id === event.conditionId);
        if (!stillOpen) {
          this.state.recoverEvent(event.eventId, result.checkedAt);
          await this.options.onTransition?.(redactForPersistence({ ...event, state: "recovered", recoveredAt: result.checkedAt }) as AttentionEvent, "recovered");
        }
      }
    }
  }
}
