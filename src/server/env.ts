import path from "node:path";

export type AppEnv = {
  port: number;
  configPath: string;
  cacheDir: string;
  staticDir: string;
};

export function readEnv(env = process.env): AppEnv {
  const configDir = env.HOMEPAGE_CONFIG_DIR ?? "/config";
  return {
    port: Number(env.PORT ?? 3000),
    configPath: env.HOMEPAGE_CONFIG_PATH ?? path.join(configDir, "homepage.yml"),
    cacheDir: env.HOMEPAGE_CACHE_DIR ?? path.join(configDir, "cache"),
    staticDir: env.HOMEPAGE_STATIC_DIR ?? path.resolve("dist/client")
  };
}
