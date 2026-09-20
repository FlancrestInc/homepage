import path from "node:path";
import { buildApp } from "../../dist-server/index.js";

const root = process.cwd();
const env = {
  port: Number(process.env.PORT ?? 3000),
  configPath: path.resolve(root, process.env.HOMEPAGE_CONFIG_PATH ?? "tests/e2e/fixtures/homepage.yml"),
  cacheDir: path.resolve(root, process.env.HOMEPAGE_CACHE_DIR ?? "test-results/e2e-cache"),
  staticDir: path.resolve(root, "dist/client")
};

const app = await buildApp(env, { startJobs: false });
await app.listen({ port: env.port, host: "0.0.0.0" });
