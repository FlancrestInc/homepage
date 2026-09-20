import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { loadConfig, saveConfig } from "../config/store.js";
import type { AppEnv } from "../env.js";
import { AuthError, requireWriteIdentity } from "../security/auth.js";

export async function registerConfigRoutes(app: FastifyInstance, env: AppEnv, options: { onConfigSaved?: () => Promise<void>; readOnly?: boolean; requireWrite?: boolean } = {}) {
  app.get("/api/config", async (_request, reply) => {
    try {
      return await loadConfig(env.configPath);
    } catch (error) {
      return handleConfigError(error, reply);
    }
  });

  app.put("/api/config", async (request, reply) => {
    if (options.readOnly) return reply.code(503).send({ error: "read_only", message: "Cockpit persistence is unavailable" });
    try {
      if (options.requireWrite ?? true) requireWriteIdentity(request, env);
      const config = await saveConfig(env.configPath, request.body);
      await options.onConfigSaved?.();
      return config;
    } catch (error) {
      if (error instanceof AuthError) return reply.code(error.statusCode).send({ error: error.code });
      return handleConfigError(error, reply);
    }
  });
}

function handleConfigError(error: unknown, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "invalid_config", issues: error.issues });
  }
  throw error;
}
