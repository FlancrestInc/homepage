import path from "node:path";

export type AppEnv = {
  port: number;
  configPath: string;
  cacheDir: string;
  staticDir: string;
  dataDir?: string;
  dbPath?: string;
  trustProxy?: boolean;
  publicOrigin?: string;
  trustedProxyCidrs?: string[];
  identityHeader?: string;
  allowedSecretRefs?: string[];
  dockerSecretsDir?: string;
  basicAuth?: {
    username: string;
    password: string;
  };
};

export function readEnv(env = process.env): AppEnv {
  const configDir = env.HOMEPAGE_CONFIG_DIR ?? "/config";
  const configPath = env.HOMEPAGE_CONFIG_PATH ?? path.join(configDir, "homepage.yml");
  const dataDir = env.COCKPIT_DATA_DIR || undefined;
  const authValues = [env.HOMEPAGE_AUTH_USER, env.HOMEPAGE_AUTH_PASSWORD];
  if (authValues.some(Boolean) && authValues.some((value) => !value)) {
    throw new Error("HOMEPAGE_AUTH_USER and HOMEPAGE_AUTH_PASSWORD must be set together");
  }

  return {
    port: Number(env.PORT ?? 3000),
    configPath,
    cacheDir: env.HOMEPAGE_CACHE_DIR ?? path.join(configDir, "cache"),
    staticDir: env.HOMEPAGE_STATIC_DIR ?? path.resolve("dist/client"),
    dataDir,
    dbPath: env.COCKPIT_DB_PATH ?? path.join(dataDir ?? path.dirname(configPath), "cockpit.db"),
    trustProxy: parseBoolean(env.COCKPIT_TRUST_PROXY, false),
    publicOrigin: env.COCKPIT_PUBLIC_ORIGIN || undefined,
    trustedProxyCidrs: parseList(env.COCKPIT_TRUSTED_PROXY_CIDRS),
    identityHeader: env.COCKPIT_IDENTITY_HEADER ?? "cf-access-authenticated-user-email",
    allowedSecretRefs: parseList(env.COCKPIT_ALLOWED_SECRET_REFS),
    dockerSecretsDir: env.COCKPIT_DOCKER_SECRETS_DIR ?? "/run/secrets",
    basicAuth: env.HOMEPAGE_AUTH_USER && env.HOMEPAGE_AUTH_PASSWORD
      ? { username: env.HOMEPAGE_AUTH_USER, password: env.HOMEPAGE_AUTH_PASSWORD }
      : undefined
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseList(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
