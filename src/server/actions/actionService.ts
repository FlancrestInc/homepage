import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { StateStore } from "../db/state.js";
import { hashToken, newActionId } from "../db/state.js";
import type { ModuleDefinition, ActionRecord, JsonValue, ModuleInstance, ConnectorContext } from "../modules/types.js";
import { ModuleRegistry } from "../modules/registry.js";

type PreparedToken = { hash: string; identity: string; instanceId: string; resourceId: string; action: string; configVersion: number; expiresAt: string; used: boolean };

export class ActionService {
  private readonly prepared = new Map<string, PreparedToken>();
  private readonly locks = new Set<string>();
  constructor(private readonly state: StateStore, private readonly registry: ModuleRegistry, private readonly refresh: (instanceId: string) => Promise<void>) {}

  prepare(instance: ModuleInstance, definition: ModuleDefinition, action: string, resourceId: string, identity: string) {
    const actionDefinition = definition.actions?.find((item) => item.id === action);
    if (!actionDefinition) throw new ActionError("action_unknown", 404);
    if (!actionDefinition.requiresConfirmation) return { required: false as const };
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const tokenId = randomUUID();
    this.prepared.set(tokenId, { hash: hashToken(token), identity, instanceId: instance.instanceId, resourceId, action, configVersion: instance.configVersion, expiresAt, used: false });
    return { required: true as const, tokenId, token, expiresAt };
  }

  async execute(input: { instance: ModuleInstance; action: string; resourceId: string; identity: string; idempotencyKey: string; requestInput: JsonValue; confirmationToken?: string; context: ConnectorContext }) {
    const definition = this.registry.get(input.instance.kind);
    if (!definition) throw new ActionError("module_not_found", 404);
    const actionDefinition = definition.actions?.find((item) => item.id === input.action);
    if (!actionDefinition) throw new ActionError("action_unknown", 404);
    const scope = `${input.identity}\0${input.instance.instanceId}\0${input.resourceId}\0${input.action}`;
    const requestFingerprint = createHash("sha256").update(stableStringify(input.requestInput)).digest("hex");
    const existing = this.state.findActionByIdempotency(scope, input.idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) throw new ActionError("idempotency_conflict", 409);
      return existing;
    }
    if (actionDefinition.requiresConfirmation) this.consumeConfirmation(input, input.confirmationToken);
    const lockKey = `${input.instance.instanceId}\0${input.resourceId}\0${input.action}`;
    if (this.locks.has(lockKey)) throw new ActionError("action_in_progress", 409);
    this.locks.add(lockKey);
    const now = new Date().toISOString();
    const record: ActionRecord = { actionId: newActionId(), idempotencyScope: scope, idempotencyKey: input.idempotencyKey, identity: input.identity, instanceId: input.instance.instanceId, resourceId: input.resourceId, action: input.action, status: "pending", createdAt: now, updatedAt: now, configVersion: input.instance.configVersion, requestFingerprint };
    this.state.createAction(record);
    try {
      let result: JsonValue = { refreshed: true };
      if (actionDefinition.execute) result = await actionDefinition.execute(input.context, input.resourceId, input.requestInput);
      else if (["refresh", "retry"].includes(input.action)) await this.refresh(input.instance.instanceId);
      const completed = this.state.updateAction(record.actionId, { status: "succeeded", result });
      return completed ?? record;
    } catch (error) {
      const completed = this.state.updateAction(record.actionId, { status: "failed", error: error instanceof Error ? error.message : "Action failed" });
      return completed ?? { ...record, status: "failed" as const, error: "Action failed" };
    } finally {
      this.locks.delete(lockKey);
    }
  }

  private consumeConfirmation(input: { instance: ModuleInstance; action: string; resourceId: string; identity: string }, token?: string) {
    if (!token) throw new ActionError("confirmation_required", 409);
    const candidate = [...this.prepared.values()].find((item) => item.hash === hashToken(token));
    if (!candidate || candidate.used || Date.parse(candidate.expiresAt) <= Date.now() || candidate.identity !== input.identity || candidate.instanceId !== input.instance.instanceId || candidate.resourceId !== input.resourceId || candidate.action !== input.action || candidate.configVersion !== input.instance.configVersion) throw new ActionError("confirmation_invalid", 409);
    candidate.used = true;
  }
}

export class ActionError extends Error {
  constructor(public readonly code: string, public readonly statusCode: number) { super(code); }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
