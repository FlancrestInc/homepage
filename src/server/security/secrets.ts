import { readFile } from "node:fs/promises";
import type { AppEnv } from "../env.js";

const envName = /^[A-Z][A-Z0-9_]{0,127}$/;
const dockerName = /^[A-Za-z0-9_.-]{1,128}$/;

export function validateSecretReference(reference: string, env: AppEnv): void {
  const match = /^(env|docker):(.+)$/.exec(reference);
  if (!match || !(match[1] === "env" ? envName : dockerName).test(match[2]) || !(env.allowedSecretRefs ?? []).includes(reference)) {
    throw new Error("secret_reference_not_allowed");
  }
}

export async function resolveSecret(reference: string, env: AppEnv): Promise<string> {
  validateSecretReference(reference, env);
  const [, kind, name] = /^(env|docker):(.+)$/.exec(reference) ?? [];
  const value = kind === "env"
    ? process.env[name]
    : await readFile(`${env.dockerSecretsDir ?? "/run/secrets"}/${name}`, "utf8").catch(() => undefined);
  if (!value) throw new Error("secret_missing");
  return value.trim();
}

export function validateSecretFields(secretFields: string[], secretRefs: Record<string, string>, env: AppEnv) {
  const keys = Object.keys(secretRefs).sort();
  const expected = [...secretFields].sort();
  if (keys.join("\0") !== expected.join("\0")) throw new Error("secret_fields_mismatch");
  for (const reference of Object.values(secretRefs)) validateSecretReference(reference, env);
}
