import { describe, expect, it } from "vitest";
import { redactForPersistence } from "../../src/server/security/redaction";
import { isTrustedProxy } from "../../src/server/security/auth";

describe("v1 security boundaries", () => {
  it("redacts credentials and sensitive values before persistence", () => {
    const result = redactForPersistence({
      password: "top-secret",
      token: "abc123",
      url: "https://user:pass@example.com/health?token=secret",
      nested: [{ apiKey: "key-value", safe: "ok" }]
    });

    expect(result).toEqual({
      password: "[redacted]",
      token: "[redacted]",
      url: "https://example.com/health?token=%5Bredacted%5D",
      nested: [{ apiKey: "[redacted]", safe: "ok" }]
    });
  });

  it("matches IPv4 proxy CIDRs, including mapped IPv4 addresses", () => {
    expect(isTrustedProxy("10.2.3.4", ["10.2.0.0/16"])).toBe(true);
    expect(isTrustedProxy("::ffff:10.2.3.4", ["10.2.0.0/16"])).toBe(true);
    expect(isTrustedProxy("10.3.3.4", ["10.2.0.0/16"])).toBe(false);
  });
});
