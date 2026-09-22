import { describe, expect, it } from "vitest";
import { readEnv } from "../../src/server/env";

describe("environment configuration", () => {
  it("reads complete Basic authentication settings", () => {
    expect(readEnv({ HOMEPAGE_AUTH_USER: "admin", HOMEPAGE_AUTH_PASSWORD: "secret" }).basicAuth).toEqual({
      username: "admin",
      password: "secret"
    });
  });

  it("rejects partially configured Basic authentication", () => {
    expect(() => readEnv({ HOMEPAGE_AUTH_USER: "admin" })).toThrow(/set together/i);
  });

  it("derives cockpit storage beside an existing config", () => {
    const value = readEnv({ HOMEPAGE_CONFIG_PATH: "/config/homepage.yml" });
    expect(value.dbPath).toBe("/config/cockpit.db");
    expect(value.cacheDir).toBe("/config/cache");
  });

  it("lets an explicit data directory and database path take precedence", () => {
    expect(readEnv({ HOMEPAGE_CONFIG_PATH: "/config/homepage.yml", COCKPIT_DATA_DIR: "/data" }).dbPath).toBe("/data/cockpit.db");
    expect(readEnv({ HOMEPAGE_CONFIG_PATH: "/config/homepage.yml", COCKPIT_DATA_DIR: "/data", COCKPIT_DB_PATH: "/state/cockpit.sqlite" }).dbPath).toBe("/state/cockpit.sqlite");
  });

  it("parses proxy settings without resolving secret values", () => {
    const value = readEnv({ COCKPIT_TRUST_PROXY: "true", COCKPIT_PUBLIC_ORIGIN: "https://cockpit.example", COCKPIT_TRUSTED_PROXY_CIDRS: "10.0.0.0/8, 127.0.0.1", COCKPIT_ALLOWED_SECRET_REFS: "env:NTFY_TOKEN,docker:apprise-url" });
    expect(value.trustProxy).toBe(true);
    expect(value.publicOrigin).toBe("https://cockpit.example");
    expect(value.trustedProxyCidrs).toEqual(["10.0.0.0/8", "127.0.0.1"]);
    expect(value.allowedSecretRefs).toEqual(["env:NTFY_TOKEN", "docker:apprise-url"]);
  });

  it("parses explicit upstream-only authentication mode", () => {
    expect(readEnv({ COCKPIT_DISABLE_AUTH: "true" }).authDisabled).toBe(true);
  });
});
