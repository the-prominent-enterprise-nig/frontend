import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Next dev-mode compiles each route's bundle on first hit rather than
  // ahead of time — with multiple workers, several specs cold-compiling
  // different routes at once can make the single shared dev server slow
  // enough to blow past even generous per-attempt retry budgets (observed:
  // a spec that passes in ~4s alone can time out entirely at 3 workers).
  // One worker trades suite speed for a server that's never contended.
  workers: 1,
  reporter: 'html',
  // Next dev-mode compiles routes on demand and keeps long-lived connections
  // open (HMR, etc.), so the browser's 'load' event is unreliable here —
  // every navigation below waits for 'domcontentloaded' instead.
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 45_000,
  },
  // Never spawns a second dev server if one is already up on baseURL — it just
  // reuses it. In CI (no dev server running yet) it starts one and waits.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/business-owner.json',
      },
      dependencies: ['setup'],
    },
  ],
})
