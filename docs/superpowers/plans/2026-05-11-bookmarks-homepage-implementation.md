# Bookmarks Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Dockerized standalone bookmarks homepage with a fast static-first render path, server-backed config editor, cached widgets, Prometheus/Glances monitor history, and scheduled bookmark health checks.

**Architecture:** A single Node.js container serves a Vite React frontend through Fastify, exposes local API endpoints for config/cache/editor operations, and runs background jobs in the same process. The browser renders bookmarks immediately from a cached public snapshot; widgets and status data refresh only from backend-prepared cache snapshots.

**Tech Stack:** TypeScript, Node.js 22, Fastify, Vite, React, Vitest, Playwright, Zod, YAML, Simple Icons, Material Design Icons, Docker.

---

## File Structure

- `package.json` - scripts, dependencies, workspace entry points.
- `tsconfig.json` - shared TypeScript configuration.
- `vite.config.ts` - frontend build/test configuration.
- `vitest.config.ts` - Node test configuration for backend modules.
- `playwright.config.ts` - browser layout verification.
- `src/server/index.ts` - process entry point, Fastify setup, scheduler startup.
- `src/server/env.ts` - environment/config path resolution.
- `src/server/config/schema.ts` - Zod schema, defaults, inferred types.
- `src/server/config/store.ts` - config load, validate, atomic save, backups.
- `src/server/cache/publicSnapshot.ts` - public snapshot builder.
- `src/server/cache/cacheStore.ts` - JSON cache read/write helpers.
- `src/server/jobs/scheduler.ts` - interval orchestration.
- `src/server/jobs/weather.ts` - weather cache refresh.
- `src/server/jobs/healthChecks.ts` - bookmark health cache refresh.
- `src/server/jobs/monitors.ts` - Prometheus and Glances monitor cache refresh.
- `src/server/integrations/prometheus.ts` - Prometheus HTTP query helpers.
- `src/server/integrations/glances.ts` - Glances HTTP helpers.
- `src/server/routes/config.ts` - editor config API.
- `src/server/routes/public.ts` - public snapshot and widget cache API.
- `src/server/routes/icons.ts` - icon search API.
- `src/client/main.tsx` - frontend entry point.
- `src/client/App.tsx` - app shell and data refresh orchestration.
- `src/client/api.ts` - browser API client.
- `src/client/types.ts` - frontend snapshot/config types.
- `src/client/components/WidgetBand.tsx` - time/weather/monitor band.
- `src/client/components/BookmarkGrid.tsx` - group and bookmark layout.
- `src/client/components/EditorDrawer.tsx` - editor shell.
- `src/client/components/BookmarkEditor.tsx` - bookmark/group editor.
- `src/client/components/WidgetEditor.tsx` - time/weather/monitor editor.
- `src/client/components/ThemeEditor.tsx` - theme editor.
- `src/client/components/IconPicker.tsx` - MDI/Simple Icons/manual icon input.
- `src/client/styles.css` - responsive app styling and themes.
- `tests/server/*.test.ts` - backend unit tests.
- `tests/e2e/*.spec.ts` - Playwright layout/editor tests.
- `Dockerfile` - production image.
- `docker-compose.example.yml` - example deployment with `/config` volume.
- `config.example.yml` - starter config.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/styles.css`
- Create: `src/server/index.ts`
- Create: `src/server/env.ts`

- [ ] **Step 1: Create package and tooling files**

Create `package.json`:

```json
{
  "name": "bookmarks-homepage",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "dev:server": "tsx watch src/server/index.ts",
    "build": "tsc --noEmit && vite build",
    "start": "node dist-server/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@fastify/static": "^8.1.1",
    "@mdi/js": "^7.4.47",
    "fastify": "^5.2.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "simple-icons": "^13.0.0",
    "yaml": "^2.6.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "*.config.ts", "vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  build: {
    outDir: "dist/client"
  }
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/server/**/*.test.ts"]
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1365, height: 768 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
```

- [ ] **Step 2: Create minimal frontend and server**

Create `src/client/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/client/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>Bookmarks Homepage</h1>
    </main>
  );
}
```

Create `src/client/styles.css`:

```css
:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #1d2a3b;
  color: #e8f0ff;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
}
```

Create `src/server/env.ts`:

```ts
import path from "node:path";

export type AppEnv = {
  port: number;
  configPath: string;
  cacheDir: string;
  staticDir: string;
};

export function readEnv(env = process.env): AppEnv {
  const configDir = env.HOMEPAGE_CONFIG_DIR ?? "/config";
  return {
    port: Number(env.PORT ?? 3000),
    configPath: env.HOMEPAGE_CONFIG_PATH ?? path.join(configDir, "homepage.yml"),
    cacheDir: env.HOMEPAGE_CACHE_DIR ?? path.join(configDir, "cache"),
    staticDir: env.HOMEPAGE_STATIC_DIR ?? path.resolve("dist/client")
  };
}
```

Create `src/server/index.ts`:

```ts
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { readEnv } from "./env";

const env = readEnv();
const app = Fastify({ logger: true });

app.get("/api/health", async () => ({ ok: true }));

await app.register(fastifyStatic, {
  root: env.staticDir,
  prefix: "/"
});

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith("/api/")) {
    return reply.code(404).send({ error: "not_found" });
  }
  return reply.sendFile("index.html", path.resolve(env.staticDir));
});

await app.listen({ port: env.port, host: "0.0.0.0" });
```

- [ ] **Step 3: Install dependencies and verify scaffold**

Run:

```bash
npm install
npm run build
```

Expected: dependencies install and Vite/TypeScript build succeeds.

- [ ] **Step 4: Commit scaffold**

Run:

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts src
git commit -m "chore: scaffold homepage app"
```

## Task 2: Config Schema and Atomic Store

**Files:**
- Create: `src/server/config/schema.ts`
- Create: `src/server/config/store.ts`
- Create: `tests/server/configStore.test.ts`
- Create: `config.example.yml`

- [ ] **Step 1: Write failing config store tests**

Create `tests/server/configStore.test.ts`:

```ts
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, saveConfig } from "../../src/server/config/store";

async function tempConfigPath() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-config-"));
  return path.join(dir, "homepage.yml");
}

describe("config store", () => {
  it("creates a default config when the config file is missing", async () => {
    const configPath = await tempConfigPath();
    const config = await loadConfig(configPath);
    expect(config.theme.mode).toBe("dark");
    expect(config.layout.editorButton).toBe("bottom-right");
    expect(config.bookmarks).toEqual([]);
  });

  it("loads valid yaml config", async () => {
    const configPath = await tempConfigPath();
    await writeFile(configPath, [
      "theme:",
      "  mode: light",
      "bookmarks:",
      "  - name: Grafana",
      "    group: Self-Hosting",
      "    icon: si-grafana",
      "    url: https://grafana.example.com"
    ].join("\n"));
    const config = await loadConfig(configPath);
    expect(config.theme.mode).toBe("light");
    expect(config.bookmarks[0]?.name).toBe("Grafana");
  });

  it("rejects invalid config saves and leaves the current file unchanged", async () => {
    const configPath = await tempConfigPath();
    await writeFile(configPath, "theme:\n  mode: dark\nbookmarks: []\n");
    await expect(saveConfig(configPath, { theme: { mode: "sepia" } })).rejects.toThrow();
    await expect(readFile(configPath, "utf8")).resolves.toContain("mode: dark");
  });

  it("atomically saves valid config and creates a backup", async () => {
    const configPath = await tempConfigPath();
    await writeFile(configPath, "theme:\n  mode: dark\nbookmarks: []\n");
    const nextConfig = await saveConfig(configPath, {
      theme: { mode: "light" },
      bookmarks: [{ name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com" }]
    });
    expect(nextConfig.theme.mode).toBe("light");
    expect(await readFile(configPath, "utf8")).toContain("mode: light");
    const files = await readdir(path.dirname(configPath));
    expect(files.some((file) => file.startsWith("homepage.yml.backup."))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/server/configStore.test.ts
```

Expected: FAIL because `src/server/config/store.ts` does not exist.

- [ ] **Step 3: Implement schema and store**

Create `src/server/config/schema.ts`:

```ts
import { z } from "zod";

const durationSchema = z.string().regex(/^\d+(s|m|h|d)$/);

export const bookmarkHealthSchema = z.object({
  mode: z.enum(["default", "custom", "disabled"]).default("default"),
  url: z.string().url().optional(),
  method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
  headers: z.record(z.string()).default({}),
  expectedStatuses: z.array(z.number().int().min(100).max(599)).default([200, 204, 301, 302, 304]),
  interval: durationSchema.optional()
});

export const bookmarkSchema = z.object({
  name: z.string().min(1),
  group: z.string().min(1),
  icon: z.string().min(1),
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
      value: z.string().default("#1d2a3b")
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
```

Create `src/server/config/store.ts`:

```ts
import { mkdir, readFile, rename, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { appConfigSchema, defaultConfig, type AppConfig } from "./schema";

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  if (!(await exists(configPath))) {
    return defaultConfig;
  }
  const raw = await readFile(configPath, "utf8");
  const parsed = raw.trim() ? YAML.parse(raw) : {};
  return appConfigSchema.parse(parsed);
}

export async function saveConfig(configPath: string, value: unknown): Promise<AppConfig> {
  const parsed = appConfigSchema.parse(value);
  const dir = path.dirname(configPath);
  await mkdir(dir, { recursive: true });

  if (await exists(configPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(configPath, path.join(dir, `${path.basename(configPath)}.backup.${stamp}`));
  }

  const tempPath = path.join(dir, `${path.basename(configPath)}.${process.pid}.tmp`);
  await writeFile(tempPath, YAML.stringify(parsed), "utf8");
  await rename(tempPath, configPath);
  return parsed;
}
```

Create `config.example.yml`:

```yaml
theme:
  mode: dark
  accentColor: "#72a6ff"
  background:
    type: color
    value: "#1d2a3b"

layout:
  editorButton: bottom-right
  groups:
    - name: Common
      order: 1
    - name: Self-Hosting
      order: 2
    - name: Development
      order: 3

bookmarks:
  - name: Grafana
    group: Self-Hosting
    icon: si-grafana
    url: https://grafana.example.com
    health:
      mode: default
  - name: GitHub
    group: Development
    icon: si-github
    url: https://github.com
    health:
      mode: default

widgets:
  refreshInterval: 30s
  time:
    enabled: true
    format: "MMM d, yyyy h:mm a"
    showSeconds: false
    hourCycle: "12"
    showTimezone: false
  weather:
    enabled: false
    provider: open-meteo
    location: Pleasant Grove, UT
    units: imperial
    refreshInterval: 30m
  monitors:
    source: prometheus
    prometheusUrl: http://prometheus:9090
    historyWindow: 6h
    sampleInterval: 5m
    refreshInterval: 5m
    servers:
      - name: Barnabas
        enabled: true
        cpuQuery: '100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle", instance="barnabas"}[5m])) * 100)'
        ramQuery: '(1 - (node_memory_MemAvailable_bytes{instance="barnabas"} / node_memory_MemTotal_bytes{instance="barnabas"})) * 100'

healthChecks:
  defaultInterval: 5m
  timeout: 5s
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/server/configStore.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit config store**

Run:

```bash
git add src/server/config tests/server/configStore.test.ts config.example.yml
git commit -m "feat: add config schema and atomic store"
```

## Task 3: Cache Store and Public Snapshot

**Files:**
- Create: `src/server/cache/cacheStore.ts`
- Create: `src/server/cache/publicSnapshot.ts`
- Create: `tests/server/publicSnapshot.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

Create `tests/server/publicSnapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPublicSnapshot } from "../../src/server/cache/publicSnapshot";
import type { AppConfig } from "../../src/server/config/schema";

const config: AppConfig = {
  theme: { mode: "dark", accentColor: "#72a6ff", background: { type: "color", value: "#1d2a3b" } },
  layout: {
    editorButton: "bottom-right",
    groups: [
      { name: "Development", order: 2 },
      { name: "Common", order: 1 }
    ]
  },
  bookmarks: [
    { name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com", health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] } },
    { name: "Search", group: "Common", icon: "mdi-magnify", url: "https://google.com", health: { mode: "disabled", method: "GET", headers: {}, expectedStatuses: [200] } }
  ],
  widgets: {
    refreshInterval: "30s",
    time: { enabled: true, format: "MMM d, yyyy h:mm a", showSeconds: false, hourCycle: "12", showTimezone: false },
    weather: { enabled: false, provider: "open-meteo", location: "Pleasant Grove, UT", units: "imperial", refreshInterval: "30m" },
    monitors: { source: "prometheus", historyWindow: "6h", sampleInterval: "5m", refreshInterval: "5m", servers: [] }
  },
  healthChecks: { defaultInterval: "5m", timeout: "5s" }
};

describe("buildPublicSnapshot", () => {
  it("orders groups and bookmarks predictably", () => {
    const snapshot = buildPublicSnapshot(config, { health: {}, weather: null, monitors: [] });
    expect(snapshot.groups.map((group) => group.name)).toEqual(["Common", "Development"]);
    expect(snapshot.groups[0]?.bookmarks[0]?.name).toBe("Search");
  });

  it("attaches cached health status to bookmarks", () => {
    const snapshot = buildPublicSnapshot(config, {
      health: { GitHub: { status: "down", checkedAt: "2026-05-11T17:00:00.000Z" } },
      weather: null,
      monitors: []
    });
    expect(snapshot.groups[1]?.bookmarks[0]?.status).toBe("down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/server/publicSnapshot.test.ts
```

Expected: FAIL because snapshot module does not exist.

- [ ] **Step 3: Implement cache helpers and snapshot builder**

Create `src/server/cache/cacheStore.ts`:

```ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readJsonCache<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonCache(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await rename(tempPath, filePath);
}
```

Create `src/server/cache/publicSnapshot.ts`:

```ts
import type { AppConfig, Bookmark } from "../config/schema";

export type HealthStatus = "up" | "down" | "unknown";

export type CachedHealth = Record<string, {
  status: HealthStatus;
  checkedAt: string;
  error?: string;
}>;

export type PublicSnapshotInput = {
  health: CachedHealth;
  weather: unknown;
  monitors: unknown[];
};

export function buildPublicSnapshot(config: AppConfig, cached: PublicSnapshotInput) {
  const configuredGroups = [...config.layout.groups].sort((a, b) => a.order - b.order);
  const groupNames = new Set(configuredGroups.map((group) => group.name));
  for (const bookmark of config.bookmarks) {
    groupNames.add(bookmark.group);
  }

  const groups = [...groupNames]
    .sort((a, b) => {
      const left = configuredGroups.find((group) => group.name === a)?.order ?? Number.MAX_SAFE_INTEGER;
      const right = configuredGroups.find((group) => group.name === b)?.order ?? Number.MAX_SAFE_INTEGER;
      return left === right ? a.localeCompare(b) : left - right;
    })
    .map((name) => ({
      ...configuredGroups.find((group) => group.name === name),
      name,
      bookmarks: config.bookmarks
        .filter((bookmark) => bookmark.group === name)
        .map((bookmark) => publicBookmark(bookmark, cached.health[bookmark.name]))
    }));

  return {
    generatedAt: new Date().toISOString(),
    theme: config.theme,
    layout: { editorButton: config.layout.editorButton },
    widgets: {
      refreshInterval: config.widgets.refreshInterval,
      time: config.widgets.time,
      weather: cached.weather,
      monitors: cached.monitors
    },
    groups
  };
}

function publicBookmark(bookmark: Bookmark, health?: CachedHealth[string]) {
  return {
    name: bookmark.name,
    group: bookmark.group,
    icon: bookmark.icon,
    url: bookmark.url,
    healthMode: bookmark.health.mode,
    status: health?.status ?? "unknown",
    checkedAt: health?.checkedAt
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/server/publicSnapshot.test.ts
npm run test -- tests/server/configStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit snapshot work**

Run:

```bash
git add src/server/cache tests/server/publicSnapshot.test.ts
git commit -m "feat: build public homepage snapshot"
```

## Task 4: API Routes

**Files:**
- Create: `src/server/routes/config.ts`
- Create: `src/server/routes/public.ts`
- Modify: `src/server/index.ts`
- Create: `tests/server/routes.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `tests/server/routes.test.ts` with Fastify injection tests for:

```ts
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/index";

describe("routes", () => {
  it("returns a public snapshot", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-routes-"));
    const app = await buildApp({
      port: 0,
      configPath: path.join(dir, "homepage.yml"),
      cacheDir: path.join(dir, "cache"),
      staticDir: path.resolve("dist/client")
    }, { serveStatic: false, startJobs: false });
    const response = await app.inject({ method: "GET", url: "/api/public-snapshot" });
    expect(response.statusCode).toBe(200);
    expect(response.json().groups).toEqual([]);
  });

  it("saves valid config through the config API", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-routes-"));
    const app = await buildApp({
      port: 0,
      configPath: path.join(dir, "homepage.yml"),
      cacheDir: path.join(dir, "cache"),
      staticDir: path.resolve("dist/client")
    }, { serveStatic: false, startJobs: false });
    const response = await app.inject({
      method: "PUT",
      url: "/api/config",
      payload: { bookmarks: [{ name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com" }] }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().bookmarks[0].name).toBe("GitHub");
  });

  it("rejects invalid config through the config API", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-routes-"));
    const app = await buildApp({
      port: 0,
      configPath: path.join(dir, "homepage.yml"),
      cacheDir: path.join(dir, "cache"),
      staticDir: path.resolve("dist/client")
    }, { serveStatic: false, startJobs: false });
    const response = await app.inject({ method: "PUT", url: "/api/config", payload: { theme: { mode: "sepia" } } });
    expect(response.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run:

```bash
npm run test -- tests/server/routes.test.ts
```

Expected: FAIL because `buildApp` and route modules are missing.

- [ ] **Step 3: Implement routes and app factory**

Create `src/server/routes/config.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { loadConfig, saveConfig } from "../config/store";
import type { AppEnv } from "../env";

export async function registerConfigRoutes(app: FastifyInstance, env: AppEnv) {
  app.get("/api/config", async () => loadConfig(env.configPath));

  app.put("/api/config", async (request, reply) => {
    try {
      return await saveConfig(env.configPath, request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "invalid_config", issues: error.issues });
      }
      throw error;
    }
  });
}
```

Create `src/server/routes/public.ts`:

```ts
import type { FastifyInstance } from "fastify";
import path from "node:path";
import { readJsonCache } from "../cache/cacheStore";
import { buildPublicSnapshot, type CachedHealth } from "../cache/publicSnapshot";
import { loadConfig } from "../config/store";
import type { AppEnv } from "../env";

export async function registerPublicRoutes(app: FastifyInstance, env: AppEnv) {
  app.get("/api/public-snapshot", async () => {
    const config = await loadConfig(env.configPath);
    const health = await readJsonCache<CachedHealth>(path.join(env.cacheDir, "health.json"), {});
    const weather = await readJsonCache<unknown>(path.join(env.cacheDir, "weather.json"), null);
    const monitors = await readJsonCache<unknown[]>(path.join(env.cacheDir, "monitors.json"), []);
    return buildPublicSnapshot(config, { health, weather, monitors });
  });
}
```

Modify `src/server/index.ts`:

```ts
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import path from "node:path";
import { readEnv, type AppEnv } from "./env";
import { registerConfigRoutes } from "./routes/config";
import { registerPublicRoutes } from "./routes/public";

export type BuildOptions = {
  serveStatic?: boolean;
  startJobs?: boolean;
};

export async function buildApp(env: AppEnv, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.get("/api/health", async () => ({ ok: true }));
  await registerConfigRoutes(app, env);
  await registerPublicRoutes(app, env);

  if (options.serveStatic ?? true) {
    await app.register(fastifyStatic, { root: env.staticDir, prefix: "/" });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html", path.resolve(env.staticDir));
    });
  }

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  const app = await buildApp(env);
  await app.listen({ port: env.port, host: "0.0.0.0" });
}
```

- [ ] **Step 4: Run route and existing tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit API routes**

Run:

```bash
git add src/server/index.ts src/server/routes tests/server/routes.test.ts
git commit -m "feat: expose config and snapshot APIs"
```

## Task 5: Background Jobs for Health, Weather, and Monitors

**Files:**
- Create: `src/server/jobs/scheduler.ts`
- Create: `src/server/jobs/healthChecks.ts`
- Create: `src/server/jobs/weather.ts`
- Create: `src/server/jobs/monitors.ts`
- Create: `src/server/integrations/prometheus.ts`
- Create: `src/server/integrations/glances.ts`
- Modify: `src/server/index.ts`
- Create: `tests/server/jobs.test.ts`

- [ ] **Step 1: Write focused job tests**

Create tests that mock `fetch` and verify:

```ts
import { describe, expect, it, vi } from "vitest";
import { refreshHealthChecks } from "../../src/server/jobs/healthChecks";
import { queryPrometheusRange } from "../../src/server/integrations/prometheus";

describe("health checks", () => {
  it("skips bookmarks with disabled health checks", async () => {
    const fetchMock = vi.fn();
    await refreshHealthChecks({
      bookmarks: [{ name: "Local", group: "Common", icon: "mdi-home", url: "https://local.example.com", health: { mode: "disabled", method: "GET", headers: {}, expectedStatuses: [200] } }],
      timeout: 1000,
      fetchImpl: fetchMock
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a bookmark down when the response status is unexpected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 500 });
    const result = await refreshHealthChecks({
      bookmarks: [{ name: "Grafana", group: "Self-Hosting", icon: "si-grafana", url: "https://grafana.example.com", health: { mode: "default", method: "GET", headers: {}, expectedStatuses: [200] } }],
      timeout: 1000,
      fetchImpl: fetchMock
    });
    expect(result.Grafana.status).toBe("down");
  });
});

describe("prometheus integration", () => {
  it("maps range query values into timestamp/value points", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", data: { result: [{ values: [[1778520000, "42.5"]] }] } })
    });
    const points = await queryPrometheusRange({
      baseUrl: "http://prometheus:9090",
      query: "up",
      start: 1778520000,
      end: 1778520300,
      step: "5m",
      fetchImpl: fetchMock
    });
    expect(points).toEqual([{ timestamp: "2026-05-11T11:20:00.000Z", value: 42.5 }]);
  });
});
```

- [ ] **Step 2: Implement job modules**

Implement:

- `refreshHealthChecks(input)` returns cached health object keyed by bookmark name.
- `refreshWeather(config)` returns `{ updatedAt, staleAfter, location, temperature, condition, error? }`.
- `refreshMonitors(config)` returns server cards with CPU/RAM percent history arrays and current values.
- `startScheduler(env)` loads config, runs jobs immediately, then schedules intervals from config.

Use `AbortSignal.timeout(timeoutMs)` for health check timeouts. Convert duration strings with this helper in `src/server/jobs/scheduler.ts`:

```ts
export function durationToMs(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 1);
}
```

- [ ] **Step 3: Wire scheduler into server startup**

In `src/server/index.ts`, import and start scheduler only when `options.startJobs ?? true`.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/server/jobs.test.ts
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit background jobs**

Run:

```bash
git add src/server/jobs src/server/integrations src/server/index.ts tests/server/jobs.test.ts
git commit -m "feat: add cached widget background jobs"
```

## Task 6: Frontend Snapshot Loading and Layout

**Files:**
- Create: `src/client/api.ts`
- Create: `src/client/types.ts`
- Create: `src/client/components/WidgetBand.tsx`
- Create: `src/client/components/BookmarkGrid.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`
- Create: `tests/e2e/homepage-layout.spec.ts`

- [ ] **Step 1: Add frontend types and API client**

Create typed client helpers:

```ts
export async function getPublicSnapshot(): Promise<PublicSnapshot> {
  const response = await fetch("/api/public-snapshot");
  if (!response.ok) throw new Error(`Snapshot request failed: ${response.status}`);
  return response.json();
}
```

Types must mirror the public snapshot shape from Task 3.

- [ ] **Step 2: Implement `WidgetBand`**

Render:

- Row 1: local date/time and cached weather.
- Row 2/3: monitor cards.
- Monitor SVG sparklines with blue CPU percent line and green RAM percent-used line.
- "as of" timestamp per monitor.

- [ ] **Step 3: Implement `BookmarkGrid`**

Render configured groups in snapshot order. Buttons use fixed 60px square dimensions on desktop, status classes `status-up`, `status-down`, `status-unknown`, and hover/focus labels.

- [ ] **Step 4: Implement `App` refresh behavior**

`App` loads snapshot once, renders bookmarks, and starts a `setInterval` using `snapshot.widgets.refreshInterval` to refresh cached widget/status data. Failed refreshes keep the previous snapshot.

- [ ] **Step 5: Add responsive CSS**

Use CSS grid with a desktop-first no-scroll target:

- `.widget-band` fixed compact top area.
- `.bookmark-groups` responsive grid.
- `.bookmark-button` stable square.
- Mobile switches to one-column scrolling layout.
- No viewport-width font scaling.

- [ ] **Step 6: Add Playwright layout tests**

Create `tests/e2e/homepage-layout.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("desktop homepage renders without vertical scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  const hasVerticalScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(hasVerticalScroll).toBe(false);
});

test("editor button is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
});
```

- [ ] **Step 7: Run verification**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 8: Commit frontend layout**

Run:

```bash
git add src/client tests/e2e/homepage-layout.spec.ts
git commit -m "feat: render homepage layout from cached snapshot"
```

## Task 7: Editor Drawer and Config Editing

**Files:**
- Create: `src/client/components/EditorDrawer.tsx`
- Create: `src/client/components/BookmarkEditor.tsx`
- Create: `src/client/components/WidgetEditor.tsx`
- Create: `src/client/components/ThemeEditor.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/styles.css`
- Create: `tests/e2e/editor.spec.ts`

- [ ] **Step 1: Extend API client**

Add:

```ts
export async function getConfig(): Promise<AppConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
  return response.json();
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config)
  });
  if (!response.ok) throw new Error(`Config save failed: ${response.status}`);
  return response.json();
}
```

- [ ] **Step 2: Implement editor shell**

`EditorDrawer` opens from the bottom-right button, has tabs for Bookmarks, Widgets, Theme, Health, and Raw Config, and traps focus while open. Use lucide icons for close/save/add/delete controls.

- [ ] **Step 3: Implement bookmark/group editing**

`BookmarkEditor` supports adding, editing, deleting, reordering bookmarks, group assignment, link, icon string, health mode, custom health URL, method, expected status codes, and interval override.

- [ ] **Step 4: Implement widget/theme editing**

`WidgetEditor` supports time/weather/monitor settings from the schema. `ThemeEditor` supports dark/light/system, accent color, background color/image, and editor button corner.

- [ ] **Step 5: Implement save behavior**

On save:

1. PUT full config to `/api/config`.
2. Close drawer only if save succeeds.
3. Reload public snapshot.
4. Display validation/server errors inline if save fails.

- [ ] **Step 6: Add editor e2e tests**

Create `tests/e2e/editor.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("opens editor drawer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("shows bookmark fields", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Bookmarks" }).click();
  await expect(page.getByRole("button", { name: "Add bookmark" })).toBeVisible();
});
```

- [ ] **Step 7: Run verification**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 8: Commit editor**

Run:

```bash
git add src/client tests/e2e/editor.spec.ts
git commit -m "feat: add side drawer config editor"
```

## Task 8: Icon Picker

**Files:**
- Create: `src/server/routes/icons.ts`
- Modify: `src/server/index.ts`
- Create: `src/client/components/IconPicker.tsx`
- Modify: `src/client/components/BookmarkEditor.tsx`
- Create: `tests/server/icons.test.ts`

- [ ] **Step 1: Write icon search tests**

Create tests that assert `/api/icons?q=grafana` returns Simple Icons/MDI-style matches with `name`, `value`, and `source`.

- [ ] **Step 2: Implement icon route**

Use `simple-icons` and `@mdi/js` metadata available in package exports. If MDI metadata names are not available from `@mdi/js`, create a small local alias map for common names initially and keep manual input as the complete fallback.

- [ ] **Step 3: Implement `IconPicker`**

The picker provides:

- Search box.
- Results grid.
- Preview.
- Manual string field.
- URL/local path mode buttons.

- [ ] **Step 4: Wire picker into bookmark editor**

Selecting an icon writes the icon string to the bookmark form and updates the preview.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm run test -- tests/server/icons.test.ts
npm run build
git add src/server/routes/icons.ts src/server/index.ts src/client/components/IconPicker.tsx src/client/components/BookmarkEditor.tsx tests/server/icons.test.ts
git commit -m "feat: add icon picker"
```

## Task 9: Docker and Deployment Files

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.example.yml`
- Modify: `README.md`

- [ ] **Step 1: Create Dockerfile**

Use multi-stage Node build:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build
RUN npx tsc src/server/index.ts --outDir dist-server --module NodeNext --moduleResolution NodeNext --target ES2022

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOMEPAGE_CONFIG_DIR=/config
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist /app/dist
COPY --from=build /app/dist-server /app/dist-server
EXPOSE 3000
VOLUME ["/config"]
CMD ["node", "dist-server/index.js"]
```

- [ ] **Step 2: Add compose example**

Create a compose file mapping `./config:/config` and exposing port `3000`.

- [ ] **Step 3: Add README**

Document:

- Docker run and compose usage.
- Config volume.
- Cloudflare Zero Trust assumption.
- Prometheus-first monitors.
- Glances fallback.
- No address-bar control in core app.

- [ ] **Step 4: Verify image builds**

Run:

```bash
docker build -t bookmarks-homepage:local .
```

Expected: image builds successfully.

- [ ] **Step 5: Commit deployment files**

Run:

```bash
git add Dockerfile .dockerignore docker-compose.example.yml README.md
git commit -m "chore: add docker deployment"
```

## Task 10: Final Verification and Polish

**Files:**
- Modify: any files implicated by the verification failures found in this task.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm run test
npm run build
npm run test:e2e
docker build -t bookmarks-homepage:local .
```

Expected: all pass.

- [ ] **Step 2: Manual visual verification**

Run the app and capture/inspect:

- Desktop 1365x768: no vertical scrollbar.
- Desktop wide: groups remain stable and not stretched awkwardly.
- Mobile: content scrolls cleanly.
- Editor drawer: fields fit and buttons do not overflow.
- Widget band: monitor cards show CPU/RAM line graphs and timestamps.

- [ ] **Step 3: Verify failure states**

Manually test:

- Missing weather cache does not block bookmarks.
- Invalid config save shows validation error.
- Down bookmark shows red pulsing outline.
- Disabled health check shows neutral/unknown status.
- Missing icon shows fallback initial.

- [ ] **Step 4: Commit final fixes**

If files changed, run:

```bash
git status --short
git add src tests README.md Dockerfile docker-compose.example.yml config.example.yml package.json package-lock.json
git commit -m "fix: polish homepage verification issues"
```

Only commit if changes were needed.

---

## Self-Review Notes

- Spec coverage: runtime architecture, local config persistence, layout, editor, widgets, Prometheus-first monitoring, Glances fallback, bookmark health checks, theming, failure states, Docker deployment, and testing are covered by tasks.
- Known implementation risk: MDI searchable metadata may require a supplemental local index because `@mdi/js` primarily exports path constants. Task 8 keeps manual icon strings as the complete fallback and requires implementing a useful initial search path.
- Address-bar behavior is intentionally excluded from this implementation plan and remains a separate future browser-extension/browser-configuration task.
