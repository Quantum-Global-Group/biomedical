import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the HetQML smoke suite.
 *
 * The smoke job assumes both servers are already running (`pnpm dev:web`
 * and `pnpm dev:api` in two terminals) — Playwright does NOT spawn them.
 * That keeps the spec hermetic: failures here mean a real UI regression,
 * not a process-management hiccup. CI launches them via a separate compose
 * step and points `PLAYWRIGHT_BASE_URL` at the right origin.
 *
 * Override knobs:
 *   PLAYWRIGHT_BASE_URL  — defaults to http://localhost:3000
 *   CI=1                 — disables `headless: false`, enables retries
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Job submissions can take 5–30s on the simulator; the default 30s
    // action timeout is too tight for the post-submit polling step.
    actionTimeout: 60_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
