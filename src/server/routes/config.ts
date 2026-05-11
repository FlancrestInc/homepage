import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { loadConfig, saveConfig } from "../config/store.js";
import type { AppEnv } from "../env.js";

export async function registerConfigRoutes(app: FastifyInstance, env: AppEnv) {
  app.get("/api/config", async () => loadConfig(env.configPath));

  app.put("/api/config", async (request, reply) => {
    try {
      return await saveConfig(env.configPath, request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "invalid_config", issues: error.issues });
      }
      throw error;
    }
  });
}
