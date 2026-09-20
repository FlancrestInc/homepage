import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readEnv, type AppEnv } from "./env.js";
import { ensureConfigFile } from "./config/store.js";
import { startScheduler } from "./jobs/scheduler.js";
import { registerConfigRoutes } from "./routes/config.js";
import { registerIconRoutes } from "./routes/icons.js";
import { registerPublicRoutes } from "./routes/public.js";

export type BuildOptions = {
  serveStatic?: boolean;
  startJobs?: boolean;
};

export async function buildApp(env: AppEnv, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await ensureConfigFile(env.configPath);

  app.addHook("onRequest", async (request, reply) => {
    if (!env.basicAuth || request.url === "/api/health" || isAuthorized(request.headers.authorization, env.basicAuth)) return;

    return reply
      .code(401)
      .header("WWW-Authenticate", 'Basic realm="Bookmarks Homepage"')
      .send({ error: "unauthorized" });
  });

  app.get("/api/health", async () => ({ ok: true }));
  const scheduler = options.startJobs ?? true ? await startScheduler(env) : undefined;
  await registerConfigRoutes(app, env, { onConfigSaved: scheduler?.reload });
  await registerIconRoutes(app);
  await registerPublicRoutes(app, env);

  if (options.serveStatic ?? true) {
    await app.register(fastifyStatic, {
      root: env.staticDir,
      prefix: "/",
      cacheControl: false
    });

    app.addHook("onSend", async (request, reply) => {
      if (request.url.startsWith("/api/")) return;

      const contentType = String(reply.getHeader("content-type") ?? "");
      if (contentType.includes("text/html")) {
        reply.header("Cache-Control", "no-cache");
      } else if (request.url.split("?", 1)[0].startsWith("/assets/")) {
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
      }
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html", path.resolve(env.staticDir));
    });
  }

  if (scheduler) {
    app.addHook("onClose", async () => {
      scheduler.stop();
    });
  }

  return app;
}

function isAuthorized(authorization: string | undefined, credentials: NonNullable<AppEnv["basicAuth"]>) {
  if (!authorization?.startsWith("Basic ")) return false;

  const encoded = authorization.slice("Basic ".length);
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  return decoded.slice(0, separator) === credentials.username && decoded.slice(separator + 1) === credentials.password;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = readEnv();
  const app = await buildApp(env);
  await app.listen({ port: env.port, host: "0.0.0.0" });
}
