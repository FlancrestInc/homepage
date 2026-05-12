import { expect, test } from "vitest";
import { validateRawConfigShape } from "../../src/client/configValidation";

test("validateRawConfigShape rejects empty objects", () => {
  expect(validateRawConfigShape({})).toEqual({
    ok: false,
    message: "Raw config is missing required object: theme"
  });
});
