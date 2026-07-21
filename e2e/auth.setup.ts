import { test as setup, expect } from '@playwright/test'
import { gotoReady, fillAllStable } from './utils'

const authFile = 'e2e/.auth/business-owner.json'

// Seeded Business Owner account (prisma/seed.ts, tenant key "technova") —
// privileged role, bypasses all permission checks, so it can drive any
// scenario across POS/CRM/Inventory/Accounting without per-test role setup.
const EMAIL = process.env.E2E_OWNER_EMAIL ?? 'technova.owner@test.com'
// Real login goes through Auth0 — but backend/src/auth/auth.service.ts has a
// dev-only bypass: if this "password" matches DEV_API_KEY from the backend's
// .env (only active when NODE_ENV !== 'production'), it skips Auth0 entirely
// and looks the user up by email directly. That's what this actually is.
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'

setup('authenticate as business owner', async ({ page }) => {
  await gotoReady(page, '/login')

  await fillAllStable([
    { locator: page.locator('#email'), value: EMAIL },
    { locator: page.locator('#password'), value: PASSWORD },
  ])

  // The submit button's onClick can still be un-hydrated the instant the form
  // finishes filling (same race fillStable works around for inputs) — retry
  // the click until the post-login redirect actually happens, rather than a
  // one-shot click that can silently no-op.
  await expect(async () => {
    await page.click('button[type="submit"]')
    // LoginForm redirects to '/' on success, which RootPage then immediately
    // server-redirects to '/dashboard' for admins (business owner included).
    await expect(page).toHaveURL('/dashboard', { timeout: 8_000 })
  }).toPass({ timeout: 20_000 })

  await page.context().storageState({ path: authFile })
})
