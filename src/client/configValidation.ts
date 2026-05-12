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

  const fieldError =
    validateTheme(value) ??
    validateLayout(value) ??
    validateBookmarks(value) ??
    validateWidgets(value) ??
    validateHealthChecks(value);

  if (fieldError) return { ok: false, message: fieldError };

  return { ok: true, config: value as AppConfig };
}

function validateTheme(value: Record<string, unknown>) {
  const theme = value.theme as Record<string, unknown>;
  const background = theme.background as Record<string, unknown>;

  return (
    requireString(theme, "theme.mode") ??
    requireString(theme, "theme.accentColor") ??
    requireString(background, "theme.background.type") ??
    requireString(background, "theme.background.value") ??
    optionalString(background, "theme.background.style")
  );
}

function validateLayout(value: Record<string, unknown>) {
  const layout = value.layout as Record<string, unknown>;
  const groups = layout.groups as unknown[];
  const editorButtonError = requireString(layout, "layout.editorButton");
  if (editorButtonError) return editorButtonError;

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const path = `layout.groups[${index}]`;
    if (!isRecord(group)) return `Raw config field ${path} must be an object.`;

    const error =
      requireString(group, `${path}.name`) ??
      requireNumber(group, `${path}.order`) ??
      optionalNumber(group, `${path}.columns`) ??
      optionalString(group, `${path}.width`) ??
      optionalNumber(group, `${path}.row`);
    if (error) return error;
  }
}

function validateBookmarks(value: Record<string, unknown>) {
  const bookmarks = value.bookmarks as unknown[];

  for (let index = 0; index < bookmarks.length; index += 1) {
    const bookmark = bookmarks[index];
    const path = `bookmarks[${index}]`;
    if (!isRecord(bookmark)) return `Raw config field ${path} must be an object.`;

    const health = bookmark.health;
    const bookmarkError =
      requireString(bookmark, `${path}.name`) ??
      requireString(bookmark, `${path}.group`) ??
      requireString(bookmark, `${path}.icon`) ??
      optionalString(bookmark, `${path}.iconColor`) ??
      requireString(bookmark, `${path}.url`);
    if (bookmarkError) return bookmarkError;

    if (!isRecord(health)) return `Raw config field ${path}.health must be an object.`;

    const healthError =
      requireString(health, `${path}.health.mode`) ??
      requireString(health, `${path}.health.method`) ??
      requireRecord(health, `${path}.health.headers`) ??
      requireArray(health, `${path}.health.expectedStatuses`) ??
      optionalString(health, `${path}.health.url`) ??
      optionalString(health, `${path}.health.interval`);
    if (healthError) return healthError;
  }
}

function validateWidgets(value: Record<string, unknown>) {
  const widgets = value.widgets as Record<string, unknown>;
  const time = widgets.time as Record<string, unknown>;
  const weather = widgets.weather as Record<string, unknown>;
  const monitors = widgets.monitors as Record<string, unknown>;

  return (
    requireString(widgets, "widgets.refreshInterval") ??
    validateTime(time) ??
    validateWeather(weather) ??
    validateMonitors(monitors)
  );
}

function validateTime(time: Record<string, unknown>) {
  return (
    requireBoolean(time, "widgets.time.enabled") ??
    requireString(time, "widgets.time.format") ??
    requireBoolean(time, "widgets.time.showSeconds") ??
    requireString(time, "widgets.time.hourCycle") ??
    optionalString(time, "widgets.time.timezone") ??
    requireBoolean(time, "widgets.time.showTimezone")
  );
}

function validateWeather(weather: Record<string, unknown>) {
  return (
    requireBoolean(weather, "widgets.weather.enabled") ??
    requireString(weather, "widgets.weather.provider") ??
    requireString(weather, "widgets.weather.location") ??
    optionalNumber(weather, "widgets.weather.latitude") ??
    optionalNumber(weather, "widgets.weather.longitude") ??
    requireString(weather, "widgets.weather.units") ??
    requireString(weather, "widgets.weather.refreshInterval")
  );
}

function validateMonitors(monitors: Record<string, unknown>) {
  const error =
    requireString(monitors, "widgets.monitors.source") ??
    optionalString(monitors, "widgets.monitors.prometheusUrl") ??
    requireString(monitors, "widgets.monitors.historyWindow") ??
    requireString(monitors, "widgets.monitors.sampleInterval") ??
    requireString(monitors, "widgets.monitors.refreshInterval");
  if (error) return error;

  const servers = monitors.servers as unknown[];
  for (let index = 0; index < servers.length; index += 1) {
    const server = servers[index];
    const path = `widgets.monitors.servers[${index}]`;
    if (!isRecord(server)) return `Raw config field ${path} must be an object.`;

    const serverError =
      requireString(server, `${path}.name`) ??
      requireBoolean(server, `${path}.enabled`) ??
      optionalString(server, `${path}.source`) ??
      optionalString(server, `${path}.cpuQuery`) ??
      optionalString(server, `${path}.ramQuery`) ??
      optionalString(server, `${path}.glancesUrl`);
    if (serverError) return serverError;
  }
}

function validateHealthChecks(value: Record<string, unknown>) {
  const healthChecks = value.healthChecks as Record<string, unknown>;
  return requireString(healthChecks, "healthChecks.defaultInterval") ?? requireString(healthChecks, "healthChecks.timeout");
}

function requireString(value: Record<string, unknown>, path: string) {
  return typeof value[pathSegment(path)] === "string" ? undefined : `Raw config field ${path} must be a string.`;
}

function optionalString(value: Record<string, unknown>, path: string) {
  const field = value[pathSegment(path)];
  return field === undefined || typeof field === "string" ? undefined : `Raw config field ${path} must be a string.`;
}

function requireNumber(value: Record<string, unknown>, path: string) {
  return typeof value[pathSegment(path)] === "number" ? undefined : `Raw config field ${path} must be a number.`;
}

function optionalNumber(value: Record<string, unknown>, path: string) {
  const field = value[pathSegment(path)];
  return field === undefined || typeof field === "number" ? undefined : `Raw config field ${path} must be a number.`;
}

function requireBoolean(value: Record<string, unknown>, path: string) {
  return typeof value[pathSegment(path)] === "boolean" ? undefined : `Raw config field ${path} must be a boolean.`;
}

function requireRecord(value: Record<string, unknown>, path: string) {
  return isRecord(value[pathSegment(path)]) ? undefined : `Raw config field ${path} must be an object.`;
}

function requireArray(value: Record<string, unknown>, path: string) {
  return Array.isArray(value[pathSegment(path)]) ? undefined : `Raw config field ${path} must be an array.`;
}

function pathSegment(path: string) {
  return path.slice(path.lastIndexOf(".") + 1);
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
