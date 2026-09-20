import type { FastifyInstance } from "fastify";
import type { StateStore } from "../db/state.js";
import type { AppEnv } from "../env.js";
import { requireWriteIdentity, AuthError } from "../security/auth.js";
import { ModuleRegistry } from "../modules/registry.js";
import type { ModuleRunner } from "../modules/runner.js";
import { ActionError, ActionService } from "../actions/actionService.js";
import { randomUUID } from "node:crypto";
import { newActionId } from "../db/state.js";
import { AttentionAggregator } from "../attention/aggregator.js";

export async function registerActionRoutes(app: FastifyInstance, input: { env: AppEnv; state: StateStore; registry: ModuleRegistry; runner: ModuleRunner; attention: AttentionAggregator }) {
  const actions = new ActionService(input.state, input.registry, (instanceId) => input.runner.refresh(instanceId));
  app.post("/api/modules/:instanceId/actions/:action/prepare", async (request, reply) => {
    try {
      const identity = requireWriteIdentity(request, input.env);
      const instance = input.state.getInstance((request.params as { instanceId: string }).instanceId);
      if (!instance) return reply.code(404).send({ error: "module_not_found" });
      const definition = input.registry.get(instance.kind);
      if (!definition) return reply.code(404).send({ error: "module_not_found" });
      const body = request.body as { resourceId?: string } | undefined;
      return actions.prepare(instance, definition, (request.params as { action: string }).action, body?.resourceId ?? "default", identity);
    } catch (error) { return actionError(reply, error); }
  });

  app.post("/api/modules/:instanceId/actions/:action", async (request, reply) => {
    try {
      const identity = requireWriteIdentity(request, input.env);
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || !idempotencyKey) return reply.code(400).send({ error: "invalid_request", issues: [{ path: ["Idempotency-Key"], message: "Required" }] });
      const instance = input.state.getInstance((request.params as { instanceId: string }).instanceId);
      if (!instance) return reply.code(404).send({ error: "module_not_found" });
      const body = request.body as { resourceId?: string; input?: unknown; confirmationToken?: string } | undefined;
      const result = await actions.execute({ instance, action: (request.params as { action: string }).action, resourceId: body?.resourceId ?? "default", identity, idempotencyKey, requestInput: (body?.input ?? null) as never, confirmationToken: body?.confirmationToken, context: { instanceId: instance.instanceId, config: instance.config, secretRefs: instance.secretRefs, signal: new AbortController().signal, resolveSecret: async (reference) => (await import("../security/secrets.js")).resolveSecret(reference, input.env), now: new Date(), request: (inputValue, init) => fetch(inputValue, init) } });
      return result;
    } catch (error) { return actionError(reply, error); }
  });

  app.get("/api/actions/:actionId", async (request, reply) => {
    const action = input.state.getAction((request.params as { actionId: string }).actionId);
    return action ?? reply.code(404).send({ error: "action_unknown" });
  });

  app.post("/api/attention/:eventId/acknowledge", async (request, reply) => {
    try {
      const identity = requireWriteIdentity(request, input.env);
      const key = request.headers["idempotency-key"];
      if (typeof key !== "string" || !key) return reply.code(400).send({ error: "invalid_request" });
      const eventId = (request.params as { eventId: string }).eventId;
      const scope = `${identity}\0attention:${eventId}\0default\0acknowledge`;
      const existingAction = input.state.findActionByIdempotency(scope, key);
      if (existingAction?.result && typeof existingAction.result === "object") return existingAction.result;
      const before = input.state.getEvent(eventId);
      const event = input.state.acknowledgeEvent(eventId, identity);
      if (event) {
        const now = new Date().toISOString();
        const action = { actionId: newActionId(), idempotencyScope: scope, idempotencyKey: key, identity, instanceId: event.instanceId, resourceId: event.resourceId, action: "acknowledge", status: "pending" as const, createdAt: now, updatedAt: now, configVersion: 1, requestFingerprint: "acknowledge" };
        input.state.createAction(action);
        input.state.updateAction(action.actionId, { status: "succeeded", result: event });
      }
      if (!before && !event) return reply.code(404).send({ error: "event_not_found" });
      return event ?? reply.code(404).send({ error: "event_not_found" });
    } catch (error) { return actionError(reply, error); }
  });
  void input.attention;
}

function actionError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: unknown) { if (error instanceof AuthError || error instanceof ActionError) return reply.code(error.statusCode).send({ error: error.code }); throw error; }
