export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const sensitiveKey = /(password|passwd|secret|token|authorization|cookie|private.?key|api.?key|ssh.?output|credential)/i;
const sensitiveQuery = /^(token|key|secret|password|passwd|auth|authorization|credential|api[_-]?key)$/i;

export function redactForPersistence(value: unknown, sensitiveValues: string[] = []): JsonValue {
  return redact(value, sensitiveValues.filter(Boolean), new WeakSet<object>());
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = "";
      url.password = "";
    }
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveQuery.test(key)) url.searchParams.set(key, "[redacted]");
    }
    return url.toString();
  } catch {
    return value;
  }
}

function redact(value: unknown, sensitiveValues: string[], seen: WeakSet<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value !== "string") return value;
    let result = value;
    for (const sensitive of sensitiveValues) result = result.split(sensitive).join("[redacted]");
    return /^https?:\/\//i.test(result) ? redactUrl(result) : result.length > 2000 ? `${result.slice(0, 2000)}…` : result;
  }
  if (typeof value !== "object") return null;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, sensitiveValues, seen));

  const output: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(value)) {
    if (sensitiveKey.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = redact(item, sensitiveValues, seen);
  }
  return output;
}
