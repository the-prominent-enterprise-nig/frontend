import { test as setup, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

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

  await fillStable(page.locator('#email'), EMAIL)
  await fillStable(page.locator('#password'), PASSWORD)

  await page.click('button[type="submit"]')

  // LoginForm redirects to '/' on success.
  await expect(page).toHaveURL('/', { timeout: 15_000 })

  await page.context().storageState({ path: authFile })
})
