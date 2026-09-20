import { createHash } from "node:crypto";
import type { AppEnv } from "../env.js";
import { resolveSecret } from "./secrets.js";

export async function fingerprintConfig(kind: string, instanceId: string, config: unknown, secretRefs: Record<string, string>, env: AppEnv) {
  const secretDigests: Record<string, string> = {};
  for (const [key, reference] of Object.entries(secretRefs).sort(([left], [right]) => left.localeCompare(right))) {
    const secret = await resolveSecret(reference, env);
    secretDigests[key] = createHash("sha256").update(secret).digest("hex");
  }
  return sha256(stableStringify({ kind, instanceId, config, secretRefs: sortObject(secretRefs), secretDigests }));
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sortObject(value: Record<string, string>) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
