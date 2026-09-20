import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { StateStore } from "../db/state.js";
import type { AppEnv } from "../env.js";
import { requireWriteIdentity, AuthError } from "../security/auth.js";
import { fingerprintConfig } from "../security/fingerprint.js";
import { validateSecretFields } from "../security/secrets.js";
import { ModuleRegistry } from "../modules/registry.js";
import type { ConnectorContext, JsonValue, ModuleInstance } from "../modules/types.js";
import { parseSecretRefs, validateSetupValues, SetupValidationError } from "../modules/validation.js";
import type { ModuleRunner } from "../modules/runner.js";
import { AttentionAggregator } from "../attention/aggregator.js";

export async function registerModuleRoutes(app: FastifyInstance, input: { env: AppEnv; state: StateStore; registry: ModuleRegistry; runner: ModuleRunner; attention: AttentionAggregator }) {
  const { env, state, registry, runner } = input;
  app.get("/api/modules", async () => registry.list().map((definition) => ({ kind: definition.kind, name: definition.name, category: definition.category, version: definition.version, setupSchema: definition.setupSchema, secretFields: definition.secretFields, actions: definition.actions?.map(({ execute: _execute, ...action }) => action), instances: state.listInstances(definition.kind).map(publicInstance) })));

  app.post("/api/modules/test", async (request, reply) => {
    try {
      requireWriteIdentity(request, env);
      const body = bodyObject(request.body);
      const kind = requiredString(body.kind, "kind");
      const instanceId = requiredString(body.instanceId, "instanceId");
      const definition = registry.get(kind);
      if (!definition) return reply.code(404).send({ error: "module_not_found" });
      const config = validateSetupValues(definition.setupSchema, body.config ?? {});
      const secretRefs = parseSecretRefs(body.secretRefs ?? {});
      validateSecretFields(definition.secretFields, secretRefs, env);
      const context = connectorContext(request, env, instanceId);
      const result = await definition.testConnection(context, config, secretRefs);
      const fingerprint = await fingerprintConfig(kind, instanceId, config, secretRefs, env);
      const testId = randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      state.saveTestBinding({ testId, kind, instanceId, fingerprint, expiresAt });
      return { testId, expiresAt, fingerprint, ...result };
    } catch (error) { return sendRouteError(reply, error); }
  });

  app.post("/api/modules", async (request, reply) => {
    try {
      const identity = requireWriteIdentity(request, env);
      const instance = await saveModule(request, env, state, registry, identity, undefined);
      await runner.reload();
      return reply.code(201).send(publicInstance(instance));
    } catch (error) { return sendRouteError(reply, error); }
  });

  app.put("/api/modules/:instanceId/config", async (request, reply) => {
    try {
      const identity = requireWriteIdentity(request, env);
      const params = request.params as { instanceId: string };
      const existing = state.getInstance(params.instanceId);
      if (!existing) return reply.code(404).send({ error: "module_not_found" });
      const instance = await saveModule(request, env, state, registry, identity, existing);
      await runner.reload();
      return publicInstance(instance);
    } catch (error) { return sendRouteError(reply, error); }
  });

  app.get("/api/modules/:instanceId/status", async (request, reply) => {
    const instance = state.getInstance((request.params as { instanceId: string }).instanceId);
    if (!instance) return reply.code(404).send({ error: "module_not_found" });
    return { instanceId: instance.instanceId, status: aggregateStatus(state.getStatuses(instance.instanceId)), resources: state.getStatuses(instance.instanceId) };
  });

  app.get("/api/modules/:instanceId/details", async (request, reply) => {
    const instance = state.getInstance((request.params as { instanceId: string }).instanceId);
    if (!instance) return reply.code(404).send({ error: "module_not_found" });
    const definition = registry.get(instance.kind);
    if (!definition?.getDetails) return reply.code(409).send({ error: "details_unavailable" });
    const resourceId = String((request.query as { resourceId?: string } | undefined)?.resourceId ?? "default");
    return definition.getDetails(connectorContext(request, env, instance.instanceId), instance, resourceId);
  });

  app.get("/api/attention", async () => state.listActiveAttention());
  app.get("/api/events", async (request) => state.listEvents(Number((request.query as { limit?: string } | undefined)?.limit ?? 100)));

  void runner;
}

async function saveModule(request: FastifyRequest, env: AppEnv, state: StateStore, registry: ModuleRegistry, _identity: string, existing?: ModuleInstance) {
  const body = bodyObject(request.body);
  const kind = existing?.kind ?? requiredString(body.kind, "kind");
  const instanceId = existing?.instanceId ?? requiredString(body.instanceId, "instanceId");
  const definition = registry.get(kind);
  if (!definition) throw new RouteError("module_not_found", 404);
  const config = validateSetupValues(definition.setupSchema, body.config ?? {});
  const secretRefs = parseSecretRefs(body.secretRefs ?? {});
  validateSecretFields(definition.secretFields, secretRefs, env);
  const testId = requiredString(body.testId, "testId");
  const binding = state.getTestBinding(testId);
  const fingerprint = await fingerprintConfig(kind, instanceId, config, secretRefs, env);
  if (!binding || binding.kind !== kind || binding.instanceId !== instanceId || binding.fingerprint !== fingerprint) throw new RouteError("test_binding_required", 409);
  return state.saveInstance({ instanceId, kind, name: String(body.name ?? existing?.name ?? instanceId), enabled: body.enabled === undefined ? true : Boolean(body.enabled), config, secretRefs, configVersion: (existing?.configVersion ?? 0) + 1, intervalMs: boundedNumber(body.intervalMs, existing?.intervalMs ?? 60000, 15_000, 86_400_000), timeoutMs: boundedNumber(body.timeoutMs, existing?.timeoutMs ?? 5000, 1_000, 30_000), staleIntervals: boundedNumber(body.staleIntervals, existing?.staleIntervals ?? 3, 1, 24) });
}

function connectorContext(_request: FastifyRequest, env: AppEnv, instanceId: string): ConnectorContext { return { instanceId, signal: new AbortController().signal, now: new Date(), resolveSecret: (reference) => import("../security/secrets.js").then(({ resolveSecret }) => resolveSecret(reference, env)), request: (input, init) => fetch(input, init) }; }
function publicInstance(instance: ModuleInstance) { return { ...instance, secretRefs: Object.fromEntries(Object.keys(instance.secretRefs).map((key) => [key, "[configured]"])) }; }
function bodyObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new RouteError("invalid_request", 400); return value as Record<string, unknown>; }
function requiredString(value: unknown, name: string) { if (typeof value !== "string" || !value) throw new RouteError("invalid_request", 400, [{ path: [name], message: "Required" }]); return value; }
function boundedNumber(value: unknown, fallback: number, min: number, max: number) { const number = value === undefined ? fallback : Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function aggregateStatus(results: Array<{ status: string }>) { if (results.some((item) => item.status === "down")) return "down"; if (results.some((item) => item.status === "degraded")) return "degraded"; if (results.some((item) => item.status === "healthy")) return "healthy"; return "unknown"; }
function sendRouteError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: unknown) { if (error instanceof AuthError || error instanceof RouteError) return reply.code(error.statusCode).send({ error: error.code, ...( "issues" in error && error.issues ? { issues: error.issues } : {}) }); if (error instanceof SetupValidationError) return reply.code(400).send({ error: error.code, issues: error.issues }); if (error instanceof ZodError) return reply.code(400).send({ error: "invalid_request", issues: error.issues }); if (error instanceof Error && error.message.startsWith("secret_")) return reply.code(400).send({ error: error.message }); throw error; }
class RouteError extends Error { constructor(public readonly code: string, public readonly statusCode: number, public readonly issues?: unknown[]) { super(code); } }
