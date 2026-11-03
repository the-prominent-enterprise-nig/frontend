import { test, expect } from '@playwright/test'
import { loginAs } from './utils'

// Where login lands: / picks the first module the role's own rows open. CRM
// brings accounting:* lookups, which used to send these roles to /accounting,
// where none of their own pages are, and on to /403 (UAT, Aircon Staff on
// staging).

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

const ROLES: [string, string][] = [
  ['Aircon Staff', 'technova.al-aircon-staff@test.com'],
  ['Sales Support', 'technova.al-sales-support@test.com'],
  ['Sales Admin', 'technova.al-sales-admin@test.com'],
  ['Service Coordinator', 'technova.al-service-coordinator@test.com'],
  ['HR Officer', 'technova.al-hr-officer@test.com'],
  ['Collector', 'technova.b1.al-collector@test.com'],
  ['Custodian', 'technova.b1.al-custodian@test.com'],
  ['Aircon Clerk', 'technova.al-aircon-clerk@test.com'],
]

test.describe('Landing after login', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const [role, email] of ROLES) {
    test(`${role} lands on a page of theirs, not 403`, async ({ page }) => {
      await loginAs(page, email, PASSWORD)
      await page.waitForURL((url) => url.pathname !== '/', { timeout: 30_000 })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      await expect(page).not.toHaveURL(/\/403/)
      await expect(page.getByText('Access Forbidden')).toHaveCount(0)
    })
  }
})
