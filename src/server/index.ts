import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readEnv, type AppEnv } from "./env.js";
import { startScheduler } from "./jobs/scheduler.js";
import { registerConfigRoutes } from "./routes/config.js";
import { registerPublicRoutes } from "./routes/public.js";

export type BuildOptions = {
  serveStatic?: boolean;
  startJobs?: boolean;
};

export async function buildApp(env: AppEnv, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.get("/api/health", async () => ({ ok: true }));
  await registerConfigRoutes(app, env);
  await registerPublicRoutes(app, env);

  if (options.serveStatic ?? true) {
    await app.register(fastifyStatic, {
      root: env.staticDir,
      prefix: "/"
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html", path.resolve(env.staticDir));
    });
  }

  if (options.startJobs ?? true) {
    const scheduler = await startScheduler(env);
    app.addHook("onClose", async () => {
      scheduler.stop();
    });
  }

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = readEnv();
  const app = await buildApp(env);
  await app.listen({ port: env.port, host: "0.0.0.0" });
}
