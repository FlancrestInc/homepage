import { randomUUID, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { redactForPersistence, type JsonValue } from "../security/redaction.js";
import type { ActionRecord, AttentionEvent, ModuleInstance, ModuleStatusResponse, StatusResult, TestBinding } from "../modules/types.js";

export type StateStore = {
  db: DatabaseSync;
  close: () => void;
  listInstances: (kind?: string) => ModuleInstance[];
  getInstance: (instanceId: string) => ModuleInstance | undefined;
  saveInstance: (input: Partial<ModuleInstance> & Pick<ModuleInstance, "instanceId" | "kind" | "name">) => ModuleInstance;
  deleteInstance: (instanceId: string) => void;
  saveStatus: (instanceId: string, result: StatusResult, failureCount: number) => void;
  getFailureCount: (instanceId: string, resourceId: string) => number;
  getStatus: (instanceId: string, resourceId: string) => StatusResult | undefined;
  getStatuses: (instanceId?: string) => StatusResult[];
  saveTestBinding: (binding: TestBinding) => void;
  getTestBinding: (testId: string) => TestBinding | undefined;
  upsertEvent: (event: AttentionEvent) => void;
  getOpenEvent: (eventKey: string) => AttentionEvent | undefined;
  getEvent: (eventId: string) => AttentionEvent | undefined;
  listEvents: (limit?: number) => AttentionEvent[];
  listActiveAttention: () => AttentionEvent[];
  acknowledgeEvent: (eventId: string, identity: string) => AttentionEvent | undefined;
  recoverEvent: (eventId: string, at?: string) => void;
  createAction: (record: ActionRecord, tokenHash?: string, tokenExpiresAt?: string) => ActionRecord;
  getAction: (actionId: string) => ActionRecord | undefined;
  findActionByIdempotency: (scope: string, key: string) => ActionRecord | undefined;
  updateAction: (actionId: string, patch: Partial<Pick<ActionRecord, "status" | "result" | "error" | "updatedAt">> & { confirmationUsedAt?: string }) => ActionRecord | undefined;
  markPendingActionsUnknown: () => void;
  getDelivery: (transportId: string, eventId: string, phase: string) => { status: string; sentAt?: string; error?: string } | undefined;
  saveDelivery: (transportId: string, eventId: string, phase: string, status: string, error?: string) => void;
};

export function createStateStore(db: DatabaseSync): StateStore {
  return {
    db,
    close: () => db.close(),
    listInstances: (kind) => rowsToInstances((kind ? db.prepare("SELECT * FROM module_instances WHERE kind = ? ORDER BY name").all(kind) : db.prepare("SELECT * FROM module_instances ORDER BY name").all()) as Record<string, unknown>[]),
    getInstance: (instanceId) => {
      const row = db.prepare("SELECT * FROM module_instances WHERE instance_id = ?").get(instanceId) as Record<string, unknown> | undefined;
      return row ? rowToInstance(row) : undefined;
    },
    saveInstance: (input) => {
      const now = new Date().toISOString();
      const previous = input.instanceId ? db.prepare("SELECT * FROM module_instances WHERE instance_id = ?").get(input.instanceId) as Record<string, unknown> | undefined : undefined;
      const instance: ModuleInstance = {
        instanceId: input.instanceId,
        kind: input.kind,
        name: input.name,
        enabled: input.enabled ?? (previous ? Boolean(previous.enabled) : false),
        config: input.config ?? (previous ? parseJson(previous.config_json) as Record<string, JsonValue> : {}),
        secretRefs: input.secretRefs ?? (previous ? parseJson(previous.secret_refs_json) as Record<string, string> : {}),
        configVersion: input.configVersion ?? (previous ? Number(previous.config_version) : 1),
        intervalMs: input.intervalMs ?? (previous ? Number(previous.interval_ms) : 60000),
        timeoutMs: input.timeoutMs ?? (previous ? Number(previous.timeout_ms) : 5000),
        staleIntervals: input.staleIntervals ?? (previous ? Number(previous.stale_intervals) : 3),
        createdAt: previous ? String(previous.created_at) : now,
        updatedAt: now
      };
      db.prepare(`INSERT INTO module_instances(instance_id, kind, name, enabled, config_json, secret_refs_json, config_version, interval_ms, timeout_ms, stale_intervals, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(instance_id) DO UPDATE SET kind=excluded.kind, name=excluded.name, enabled=excluded.enabled, config_json=excluded.config_json, secret_refs_json=excluded.secret_refs_json, config_version=excluded.config_version, interval_ms=excluded.interval_ms, timeout_ms=excluded.timeout_ms, stale_intervals=excluded.stale_intervals, updated_at=excluded.updated_at`).run(
        instance.instanceId, instance.kind, instance.name, instance.enabled ? 1 : 0, JSON.stringify(redactForPersistence(instance.config)), JSON.stringify(redactForPersistence(instance.secretRefs)), instance.configVersion, instance.intervalMs, instance.timeoutMs, instance.staleIntervals, instance.createdAt, instance.updatedAt
      );
      return instance;
    },
    deleteInstance: (instanceId) => { db.prepare("DELETE FROM module_instances WHERE instance_id = ?").run(instanceId); },
    saveStatus: (instanceId, result, failureCount) => {
      const safe = redactForPersistence(result) as Record<string, JsonValue>;
      db.prepare(`INSERT INTO module_status(instance_id, resource_id, status_json, failure_count, checked_at, last_success_at, stale_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(instance_id, resource_id) DO UPDATE SET status_json=excluded.status_json, failure_count=excluded.failure_count, checked_at=excluded.checked_at, last_success_at=excluded.last_success_at, stale_at=excluded.stale_at`).run(
        instanceId, result.resourceId, JSON.stringify(safe), failureCount, result.checkedAt, result.lastSuccessAt, result.staleAt
      );
    },
    getFailureCount: (instanceId, resourceId) => {
      const row = db.prepare("SELECT failure_count FROM module_status WHERE instance_id = ? AND resource_id = ?").get(instanceId, resourceId) as { failure_count?: number } | undefined;
      return Number(row?.failure_count ?? 0);
    },
    getStatus: (instanceId, resourceId) => {
      const row = db.prepare("SELECT status_json FROM module_status WHERE instance_id = ? AND resource_id = ?").get(instanceId, resourceId) as { status_json?: string } | undefined;
      return row?.status_json ? JSON.parse(row.status_json) as StatusResult : undefined;
    },
    getStatuses: (instanceId) => {
      const rows = (instanceId ? db.prepare("SELECT status_json FROM module_status WHERE instance_id = ? ORDER BY resource_id").all(instanceId) : db.prepare("SELECT status_json FROM module_status ORDER BY instance_id, resource_id").all()) as Array<{ status_json: string }>;
      return rows.map((row) => JSON.parse(row.status_json) as StatusResult);
    },
    saveTestBinding: (binding) => { db.prepare("INSERT OR REPLACE INTO test_bindings(test_id, kind, instance_id, fingerprint, expires_at) VALUES (?, ?, ?, ?, ?)").run(binding.testId, binding.kind, binding.instanceId, binding.fingerprint, binding.expiresAt); },
    getTestBinding: (testId) => {
      const row = db.prepare("SELECT * FROM test_bindings WHERE test_id = ? AND expires_at > ?").get(testId, new Date().toISOString()) as Record<string, unknown> | undefined;
      return row ? { testId: String(row.test_id), kind: String(row.kind), instanceId: String(row.instance_id), fingerprint: String(row.fingerprint), expiresAt: String(row.expires_at) } : undefined;
    },
    upsertEvent: (event) => {
      const safe = redactForPersistence(event) as Record<string, JsonValue>;
      db.prepare(`INSERT INTO attention_events(event_id,event_key,instance_id,resource_id,condition_id,severity,state,event_json,opened_at,last_seen_at,acknowledged_at,acknowledged_by,recovered_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET state=excluded.state,event_json=excluded.event_json,last_seen_at=excluded.last_seen_at,acknowledged_at=excluded.acknowledged_at,acknowledged_by=excluded.acknowledged_by,recovered_at=excluded.recovered_at`).run(
        event.eventId, event.eventKey, event.instanceId, event.resourceId, event.conditionId, event.severity, event.state, JSON.stringify(safe), event.openedAt, event.lastSeenAt, event.acknowledgedAt ?? null, event.acknowledgedBy ?? null, event.recoveredAt ?? null
      );
    },
    getOpenEvent: (eventKey) => {
      const row = db.prepare("SELECT event_json FROM attention_events WHERE event_key = ? AND state IN ('open','acknowledged') ORDER BY opened_at DESC LIMIT 1").get(eventKey) as { event_json?: string } | undefined;
      return row?.event_json ? JSON.parse(row.event_json) as AttentionEvent : undefined;
    },
    getEvent: (eventId) => {
      const row = db.prepare("SELECT event_json FROM attention_events WHERE event_id = ?").get(eventId) as { event_json?: string } | undefined;
      return row?.event_json ? JSON.parse(row.event_json) as AttentionEvent : undefined;
    },
    listEvents: (limit = 100) => (db.prepare("SELECT event_json FROM attention_events ORDER BY opened_at DESC LIMIT ?").all(Math.max(1, Math.min(limit, 500))) as Array<{ event_json: string }>).map((row) => JSON.parse(row.event_json) as AttentionEvent),
    listActiveAttention: () => (db.prepare("SELECT event_json FROM attention_events WHERE state = 'open' ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END, opened_at").all() as Array<{ event_json: string }>).map((row) => JSON.parse(row.event_json) as AttentionEvent),
    acknowledgeEvent: (eventId, identity) => {
      const event = getEventInternal(db, eventId);
      if (!event || event.state !== "open") return event;
      const next = { ...event, state: "acknowledged" as const, acknowledgedAt: new Date().toISOString(), acknowledgedBy: identity };
      storeEvent(db, next);
      return next;
    },
    recoverEvent: (eventId, at = new Date().toISOString()) => {
      const event = getEventInternal(db, eventId);
      if (!event || event.state === "recovered") return;
      storeEvent(db, { ...event, state: "recovered", recoveredAt: at, lastSeenAt: at });
    },
    createAction: (record, tokenHash, tokenExpiresAt) => {
      db.prepare(`INSERT INTO actions(action_id,idempotency_scope,idempotency_key,identity,instance_id,resource_id,action,status,created_at,updated_at,config_version,request_fingerprint,result_json,error,confirmation_token_hash,confirmation_expires_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(record.actionId, record.idempotencyScope, record.idempotencyKey, record.identity, record.instanceId, record.resourceId, record.action, record.status, record.createdAt, record.updatedAt, record.configVersion, record.requestFingerprint, record.result ? JSON.stringify(redactForPersistence(record.result)) : null, record.error ?? null, tokenHash ?? null, tokenExpiresAt ?? null);
      return record;
    },
    getAction: (actionId) => rowToAction(db.prepare("SELECT * FROM actions WHERE action_id = ?").get(actionId) as Record<string, unknown> | undefined),
    findActionByIdempotency: (scope, key) => rowToAction(db.prepare("SELECT * FROM actions WHERE idempotency_scope = ? AND idempotency_key = ?").get(scope, key) as Record<string, unknown> | undefined),
    updateAction: (actionId, patch) => {
      const current = rowToAction(db.prepare("SELECT * FROM actions WHERE action_id = ?").get(actionId) as Record<string, unknown> | undefined);
      if (!current) return undefined;
      const next = { ...current, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() };
      db.prepare("UPDATE actions SET status=?, updated_at=?, result_json=?, error=?, confirmation_used_at=COALESCE(?, confirmation_used_at) WHERE action_id=?").run(next.status, next.updatedAt, next.result === undefined ? null : JSON.stringify(redactForPersistence(next.result)), next.error ?? null, patch.confirmationUsedAt ?? null, actionId);
      return next;
    },
    markPendingActionsUnknown: () => { db.prepare("UPDATE actions SET status='unknown', updated_at=?, error=COALESCE(error, 'Process restarted before action completed') WHERE status='pending'").run(new Date().toISOString()); },
    getDelivery: (transportId, eventId, phase) => {
      const row = db.prepare("SELECT status, sent_at, error FROM notification_deliveries WHERE transport_id=? AND event_id=? AND phase=?").get(transportId, eventId, phase) as Record<string, unknown> | undefined;
      return row ? { status: String(row.status), sentAt: row.sent_at ? String(row.sent_at) : undefined, error: row.error ? String(row.error) : undefined } : undefined;
    },
    saveDelivery: (transportId, eventId, phase, status, error) => { db.prepare("INSERT OR REPLACE INTO notification_deliveries(transport_id,event_id,phase,status,sent_at,error) VALUES(?,?,?,?,?,?)").run(transportId, eventId, phase, status, status === "sent" ? new Date().toISOString() : null, error ?? null); }
  };
}

function rowToInstance(row: Record<string, unknown>): ModuleInstance {
  return { instanceId: String(row.instance_id), kind: String(row.kind), name: String(row.name), enabled: Boolean(row.enabled), config: parseJson(row.config_json) as Record<string, JsonValue>, secretRefs: parseJson(row.secret_refs_json) as Record<string, string>, configVersion: Number(row.config_version), intervalMs: Number(row.interval_ms), timeoutMs: Number(row.timeout_ms), staleIntervals: Number(row.stale_intervals), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

function rowsToInstances(rows: Record<string, unknown>[]) { return rows.map(rowToInstance); }
function parseJson(value: unknown): JsonValue { return typeof value === "string" ? JSON.parse(value) as JsonValue : {}; }
function getEventInternal(db: DatabaseSync, eventId: string) { const row = db.prepare("SELECT event_json FROM attention_events WHERE event_id=?").get(eventId) as { event_json?: string } | undefined; return row?.event_json ? JSON.parse(row.event_json) as AttentionEvent : undefined; }
function storeEvent(db: DatabaseSync, event: AttentionEvent) { const safe = redactForPersistence(event) as Record<string, JsonValue>; db.prepare("UPDATE attention_events SET state=?,event_json=?,last_seen_at=?,acknowledged_at=?,acknowledged_by=?,recovered_at=? WHERE event_id=?").run(event.state, JSON.stringify(safe), event.lastSeenAt, event.acknowledgedAt ?? null, event.acknowledgedBy ?? null, event.recoveredAt ?? null, event.eventId); }
function rowToAction(row: Record<string, unknown> | undefined): ActionRecord | undefined {
  if (!row) return undefined;
  return { actionId: String(row.action_id), idempotencyScope: String(row.idempotency_scope), idempotencyKey: String(row.idempotency_key), identity: String(row.identity), instanceId: String(row.instance_id), resourceId: String(row.resource_id), action: String(row.action), status: row.status as ActionRecord["status"], createdAt: String(row.created_at), updatedAt: String(row.updated_at), configVersion: Number(row.config_version), requestFingerprint: String(row.request_fingerprint), result: row.result_json ? JSON.parse(String(row.result_json)) as JsonValue : undefined, error: row.error ? String(row.error) : undefined };
}

export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newActionId() { return randomUUID(); }
