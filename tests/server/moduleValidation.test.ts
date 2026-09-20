import { describe, expect, it } from "vitest";
import { SetupValidationError, validateSetupValues } from "../../src/server/modules/validation";

describe("module setup validation", () => {
  it("enforces required fields and declared types", () => {
    expect(() => validateSetupValues({ fields: [
      { key: "url", label: "URL", type: "url", required: true },
      { key: "source", label: "Source", type: "select", required: true, options: ["http", "ssh"] }
    ] }, { url: "not-a-url", source: "ftp" })).toThrow(SetupValidationError);
  });

  it("accepts valid setup values", () => {
    expect(validateSetupValues({ fields: [
      { key: "url", label: "URL", type: "url", required: true },
      { key: "enabled", label: "Enabled", type: "boolean" },
      { key: "source", label: "Source", type: "select", options: ["http", "ssh"] }
    ] }, { url: "https://example.com", enabled: false, source: "http" })).toEqual({ url: "https://example.com", enabled: false, source: "http" });
  });
});
