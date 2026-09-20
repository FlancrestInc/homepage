import { z } from "zod";
import type { JsonValue, ModuleStatusResponse, SetupSchema, StatusResult } from "./types.js";

const jsonSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.array(jsonSchema),
  z.record(jsonSchema)
]));

export const setupValuesSchema = z.record(jsonSchema);
export const secretRefsSchema = z.record(z.string().regex(/^(env|docker):[A-Za-z0-9_.-]+$/));
export const actionInputSchema = jsonSchema;

export function parseSetupValues(value: unknown) {
  return setupValuesSchema.parse(value);
}

export function validateSetupValues(schema: SetupSchema, value: unknown) {
  const values = parseSetupValues(value);
  const issues: Array<{ path: string[]; message: string }> = [];
  for (const field of schema.fields) {
    const current = values[field.key];
    const missing = current === undefined || current === null || (typeof current === "string" && current.trim() === "");
    if (missing) {
      if (field.required) issues.push({ path: [field.key], message: "Required" });
      continue;
    }
    if (field.type === "url") {
      try {
        const url = new URL(String(current));
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
      } catch {
        issues.push({ path: [field.key], message: "Must be an HTTP or HTTPS URL" });
      }
    } else if (field.type === "number" && !Number.isFinite(Number(current))) {
      issues.push({ path: [field.key], message: "Must be a number" });
    } else if (field.type === "boolean" && typeof current !== "boolean") {
      issues.push({ path: [field.key], message: "Must be a boolean" });
    } else if (field.type === "select" && !field.options?.includes(String(current))) {
      issues.push({ path: [field.key], message: "Must be one of the configured options" });
    } else if (["text", "url", "secretRef"].includes(field.type) && typeof current !== "string") {
      issues.push({ path: [field.key], message: "Must be text" });
    }
  }
  if (issues.length) throw new SetupValidationError(issues);
  return values;
}

export function parseSecretRefs(value: unknown) {
  return secretRefsSchema.parse(value);
}

export function parseJsonValue(value: unknown): JsonValue {
  return jsonSchema.parse(value);
}

export function parseStatusResponse(value: unknown): ModuleStatusResponse {
  return value as ModuleStatusResponse;
}

export function parseStatusResult(value: unknown): StatusResult {
  return value as StatusResult;
}

export class SetupValidationError extends Error {
  readonly code = "invalid_request";
  constructor(readonly issues: Array<{ path: string[]; message: string }>) { super("invalid_request"); }
}
