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
});
