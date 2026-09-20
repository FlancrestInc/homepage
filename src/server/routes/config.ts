import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { loadConfig, saveConfig } from "../config/store.js";
import type { AppEnv } from "../env.js";

export async function registerConfigRoutes(app: FastifyInstance, env: AppEnv, options: { onConfigSaved?: () => Promise<void> } = {}) {
  app.get("/api/config", async (_request, reply) => {
    try {
      return await loadConfig(env.configPath);
    } catch (error) {
      return handleConfigError(error, reply);
    }
  });

  app.put("/api/config", async (request, reply) => {
    try {
      const config = await saveConfig(env.configPath, request.body);
      await options.onConfigSaved?.();
      return config;
    } catch (error) {
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
