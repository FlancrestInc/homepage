import type { AppConfig } from "./types";

export type RawConfigValidation =
  | { ok: true; config: AppConfig }
  | { ok: false; message: string };

const requiredObjectPaths = [
  "theme",
  "theme.background",
  "layout",
  "widgets",
  "widgets.time",
  "widgets.weather",
  "widgets.monitors",
  "healthChecks"
];

const requiredArrayPaths = ["bookmarks", "layout.groups", "widgets.monitors.servers"];

export function validateRawConfigShape(value: unknown): RawConfigValidation {
  if (!isRecord(value)) {
    return { ok: false, message: "Raw config must be a JSON object." };
  }

  for (const path of requiredObjectPaths) {
    if (!isRecord(valueAtPath(value, path))) {
      return { ok: false, message: `Raw config is missing required object: ${path}` };
    }
  }

  for (const path of requiredArrayPaths) {
    if (!Array.isArray(valueAtPath(value, path))) {
      return { ok: false, message: `Raw config is missing required array: ${path}` };
    }
  }

  return { ok: true, config: value as AppConfig };
}

function valueAtPath(value: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((currentValue, segment) => {
    if (!isRecord(currentValue)) return undefined;
    return currentValue[segment];
  }, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
