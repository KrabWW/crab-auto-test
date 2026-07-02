import { defineConfig } from "@playwright/test";

/**
 * D1 tracer-bullet e2e config.
 *
 * NOTE: This config wires Playwright; the e2e suite (tests/e2e/tracer-bullet.spec.ts)
 * exercises the full MVP loop against a running stack (api + web). It is gated on
 * the stack being up + seeded admin. In CI it runs after migrate+seed; locally it
 * runs via: pnpm --filter @crab/web test:e2e (with api + web dev servers up).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.E2E_WEB_BASE ?? "http://localhost:3001",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3001",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
