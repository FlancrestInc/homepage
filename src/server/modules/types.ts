import type { JsonValue } from "../security/redaction.js";
export type { JsonValue } from "../security/redaction.js";

export type ModuleStatus = "healthy" | "degraded" | "down" | "unknown";
export type Freshness = "fresh" | "stale" | "never_succeeded";

export type SetupField = {
  key: string;
  label: string;
  type: "text" | "url" | "number" | "boolean" | "select" | "secretRef";
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

export type SetupSchema = { fields: SetupField[] };

export type StatusField = {
  key: string;
  status: "healthy" | "degraded" | "unknown";
  value: JsonValue;
  error?: string;
};

export type StatusResult = {
  instanceId: string;
  resourceId: string;
  status: ModuleStatus;
  checkedAt: string;
  lastSuccessAt: string | null;
  staleAt: string | null;
  freshness: Freshness;
  summary: string;
  fields: StatusField[];
  evidence: Record<string, JsonValue>;
  error?: string;
};

export type ModuleStatusResponse = {
  instanceId: string;
  status: ModuleStatus;
  resources: StatusResult[];
};

export type ModuleInstance = {
  instanceId: string;
  kind: string;
  name: string;
  enabled: boolean;
  config: Record<string, JsonValue>;
  secretRefs: Record<string, string>;
  configVersion: number;
  intervalMs: number;
  timeoutMs: number;
  staleIntervals: number;
  createdAt: string;
  updatedAt: string;
};

export type AttentionSeverity = "warning" | "critical";
export type AttentionState = "open" | "acknowledged" | "recovered";

export type AttentionEvent = {
  eventId: string;
  eventKey: string;
  instanceId: string;
  resourceId: string;
  conditionId: string;
  severity: AttentionSeverity;
  state: AttentionState;
  title: string;
  summary: string;
  evidence: Record<string, JsonValue>;
  openedAt: string;
  lastSeenAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  recoveredAt?: string;
  nextAction?: { label: string; action: string };
  link?: string;
}

export type ActionDefinition = {
  id: string;
  label: string;
  requiresConfirmation?: boolean;
  inputSchema?: SetupSchema;
  execute?: (context: ConnectorContext, resourceId: string, input: JsonValue) => Promise<JsonValue>;
};

export type ConditionDefinition = {
  id: string;
  severity: AttentionSeverity;
  title: string;
  when: (result: StatusResult) => boolean;
  summary?: (result: StatusResult) => string;
  nextAction?: { label: string; action: string };
};

export type ConnectorContext = {
  instanceId: string;
  config?: Record<string, JsonValue>;
  secretRefs?: Record<string, string>;
  signal: AbortSignal;
  now: Date;
  resolveSecret: (reference: string) => Promise<string>;
  request: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
};

export type ModuleDefinition = {
  kind: string;
  name: string;
  category: string;
  version: number;
  setupSchema: SetupSchema;
  secretFields: string[];
  testConnection: (context: ConnectorContext, config: Record<string, JsonValue>, secretRefs: Record<string, string>) => Promise<{ ok: boolean; message: string; details?: Record<string, JsonValue> }>;
  getStatus: (context: ConnectorContext, instance: ModuleInstance) => Promise<ModuleStatusResponse>;
  getDetails?: (context: ConnectorContext, instance: ModuleInstance, resourceId: string) => Promise<JsonValue>;
  actions?: ActionDefinition[];
  conditions?: ConditionDefinition[];
  links?: (instance: ModuleInstance, resourceId: string) => string[];
  dependencies?: string[];
};

export type TestBinding = {
  testId: string;
  kind: string;
  instanceId: string;
  fingerprint: string;
  expiresAt: string;
};

export type ActionRecord = {
  actionId: string;
  idempotencyScope: string;
  idempotencyKey: string;
  identity: string;
  instanceId: string;
  resourceId: string;
  action: string;
  status: "pending" | "succeeded" | "failed" | "unknown";
  createdAt: string;
  updatedAt: string;
  configVersion: number;
  requestFingerprint: string;
  result?: JsonValue;
  error?: string;
};
