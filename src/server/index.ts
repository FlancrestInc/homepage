import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { readEnv } from "./env";

const env = readEnv();
const app = Fastify({ logger: true });

app.get("/api/health", async () => ({ ok: true }));

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

await app.listen({ port: env.port, host: "0.0.0.0" });
