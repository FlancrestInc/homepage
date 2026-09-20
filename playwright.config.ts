import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "node_modules/.bin/vite build && node_modules/.bin/tsc -p tsconfig.server.json && node tests/e2e/server.mjs",
    env: {
      ...process.env,
      HOMEPAGE_CONFIG_PATH: "tests/e2e/fixtures/homepage.yml",
      HOMEPAGE_CACHE_DIR: "test-results/e2e-cache",
      HOMEPAGE_AUTH_USER: "",
      HOMEPAGE_AUTH_PASSWORD: ""
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1365, height: 768 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
