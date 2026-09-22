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
import { openDatabase } from "./db/database.js";
import type { StateStore } from "./db/state.js";
import { createCoreRegistry, seedV1Instances } from "./modules/catalog.js";
import { ModuleRunner } from "./modules/runner.js";
import { AttentionAggregator } from "./attention/aggregator.js";
import { NotificationDispatcher } from "./notifications/dispatcher.js";
import { registerModuleRoutes } from "./routes/modules.js";
import { registerActionRoutes } from "./routes/actions.js";
import { readIdentity } from "./security/auth.js";

export type BuildOptions = {
  serveStatic?: boolean;
  startJobs?: boolean;
};

export async function buildApp(env: AppEnv, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await ensureConfigFile(env.configPath);

  let state: StateStore | undefined;
  let readOnly = false;
  try {
    state = await openDatabase(env);
    state.markPendingActionsUnknown();
    seedV1Instances(state);
  } catch (error) {
    readOnly = true;
    app.log.error({ err: error }, "Cockpit database unavailable; running bookmarks in read-only mode");
  }

  app.addHook("onRequest", async (request, reply) => {
    if (env.authDisabled) return;
    if (request.url === "/api/health") return;
    const basicAuthorized = env.basicAuth ? isAuthorized(request.headers.authorization, env.basicAuth) : false;
    const proxyAuthorized = env.trustProxy ? Boolean(readIdentity(request, env)) : false;
    if (basicAuthorized || proxyAuthorized || (!env.basicAuth && !env.trustProxy)) return;

    return reply
      .code(401)
      .header("WWW-Authenticate", 'Basic realm="Bookmarks Homepage"')
      .send({ error: "unauthorized" });
  });

  app.get("/api/health", async () => ({ ok: true, cockpit: readOnly ? "degraded" : "ok" }));
  const scheduler = options.startJobs ?? true ? await startScheduler(env) : undefined;
  const registry = createCoreRegistry();
  const dispatcher = state ? new NotificationDispatcher(state, env) : undefined;
  const attention = state ? new AttentionAggregator(state, { onTransition: (event, phase) => dispatcher?.notify(event, phase, state?.listInstances().filter((instance) => instance.kind.startsWith("notify.")) ?? []) }) : undefined;
  const runner = state && attention ? new ModuleRunner(state, registry, env, { onStatus: (result) => { const kind = state?.getInstance(result.instanceId)?.kind; return attention.onStatus(result, kind ? registry.get(kind) : undefined); } }) : undefined;
  if (runner && options.startJobs !== false) await runner.start();
  const reminderTimer = state && dispatcher && options.startJobs !== false ? setInterval(() => { void dispatcher.remind(state?.listActiveAttention() ?? [], state?.listInstances().filter((instance) => instance.kind.startsWith("notify.")) ?? []); }, 60_000) : undefined;
  await registerConfigRoutes(app, env, { onConfigSaved: async () => { await scheduler?.reload(); await runner?.reload(); }, readOnly, requireWrite: true });
  await registerIconRoutes(app);
  await registerPublicRoutes(app, env, state ? { state, registry } : undefined);
  if (state && runner && attention) {
    await registerModuleRoutes(app, { env, state, registry, runner, attention });
    await registerActionRoutes(app, { env, state, registry, runner, attention });
  }

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
  if (runner) app.addHook("onClose", async () => runner.stop());
  if (reminderTimer) app.addHook("onClose", async () => clearInterval(reminderTimer));
  if (state) app.addHook("onClose", async () => state?.close());

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
