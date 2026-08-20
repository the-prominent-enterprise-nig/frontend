import { defineConfig, devices } from '@playwright/test'

// Isolated backend+frontend pair, both on ports distinct from the real dev
// servers (:3001 / :3000), each pointed at a dedicated the-prominent-enterprise-test
// Postgres DB — so e2e fixtures never land in the DB the dev server/manual
// QA uses. See backend/package.json's start:e2e (full reset + reseed, then
// boot) for the other half of this.
const backendPort = process.env.E2E_BACKEND_PORT ?? '3011'
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '3010'
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${frontendPort}`

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
  // Never spawns a second pair if the isolated stack is already up — it just
  // reuses it. In CI (nothing running yet) it starts both fresh. Either way
  // this never touches the real dev server on :3000/:3001 or its DB.
  webServer: [
    {
      // Full DB reset + reseed happens inside start:e2e itself, only on a
      // cold start — see backend/package.json.
      command: 'npm --prefix ../backend run start:e2e',
      url: `http://localhost:${backendPort}`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: `npm run dev -- -p ${frontendPort}`,
      url: baseURL,
      reuseExistingServer: true,
      // E2E_ISOLATED makes next.config.ts use a separate distDir (.next-e2e)
      // so this doesn't fight the real dev server for the .next/dev/lock.
      env: { API_URL: `http://localhost:${backendPort}`, E2E_ISOLATED: '1' },
      timeout: 120_000,
    },
  ],
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
