import { z } from "zod";

const durationSchema = z.string().regex(/^\d+(s|m|h|d)$/);

export const bookmarkHealthSchema = z.object({
  mode: z.enum(["default", "custom", "disabled"]).default("default"),
  url: z.string().url().optional(),
  method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
  headers: z.record(z.string()).default({}),
  expectedStatuses: z.array(z.number().int().min(100).max(599)).default([200, 204, 301, 302, 304, 401, 403]),
  interval: durationSchema.optional()
});

export const bookmarkSchema = z.object({
  name: z.string().min(1),
  group: z.string().min(1),
  icon: z.string().min(1),
  iconColor: z.string().optional(),
  url: z.string().url(),
  health: bookmarkHealthSchema.default({})
});

export const groupSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().default(0),
  columns: z.number().int().min(1).max(8).optional(),
  width: z.enum(["compact", "normal", "wide"]).optional(),
  row: z.number().int().min(1).optional()
});

export const appConfigSchema = z.object({
  theme: z.object({
    mode: z.enum(["light", "dark", "system"]).default("dark"),
    accentColor: z.string().default("#72a6ff"),
    background: z.object({
      type: z.enum(["color", "image"]).default("color"),
      value: z.string().default("#1d2a3b"),
      style: z.enum(["cover", "contain", "stretch", "tile", "center"]).default("cover")
    }).default({})
  }).default({}),
  layout: z.object({
    editorButton: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
    groups: z.array(groupSchema).default([])
  }).default({}),
  bookmarks: z.array(bookmarkSchema).default([]),
  widgets: z.object({
    refreshInterval: durationSchema.default("30s"),
    time: z.object({
      enabled: z.boolean().default(true),
      format: z.string().default("MMM d, yyyy h:mm a"),
      showSeconds: z.boolean().default(false),
      hourCycle: z.enum(["12", "24"]).default("12"),
      timezone: z.string().optional(),
      showTimezone: z.boolean().default(false)
    }).default({}),
    weather: z.object({
      enabled: z.boolean().default(false),
      provider: z.enum(["open-meteo"]).default("open-meteo"),
      location: z.string().default("Pleasant Grove, UT"),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      units: z.enum(["imperial", "metric"]).default("imperial"),
      refreshInterval: durationSchema.default("30m")
    }).default({}),
    monitors: z.object({
      source: z.enum(["prometheus", "glances"]).default("prometheus"),
      prometheusUrl: z.string().url().optional(),
      historyWindow: durationSchema.default("6h"),
      sampleInterval: durationSchema.default("5m"),
      refreshInterval: durationSchema.default("5m"),
      servers: z.array(z.object({
        name: z.string().min(1),
        source: z.enum(["prometheus", "glances"]).optional(),
        enabled: z.boolean().default(true),
        cpuQuery: z.string().optional(),
        ramQuery: z.string().optional(),
        glancesUrl: z.string().url().optional()
      })).default([])
    }).default({})
  }).default({}),
  healthChecks: z.object({
    defaultInterval: durationSchema.default("5m"),
    timeout: durationSchema.default("5s")
  }).default({})
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const defaultConfig: AppConfig = appConfigSchema.parse({});
