import { test, expect } from '@playwright/test'
import {
  deleteCustomers,
  fillAllStable,
  fillPhoneStable,
  gotoReady,
  sweepE2ECustomers,
} from './utils'

const SEED_NAME = 'Original Duplicate Owner'
const NAME_PREFIX = 'E2E DupWarning'

// CRM — Customer Duplicate Warning (scenario-02, 2026-07-31 update): "ERP
// flags exact or possible duplicates" — a non-blocking warning the Cashier
// can dismiss and still proceed, not a hard stop.
test.describe('CRM — Customer Duplicate Warning', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, SEED_NAME)
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await deleteCustomers(request, createdIds)
    createdIds = []
  })

  test('warns on a duplicate email but still allows creating the profile', async ({ page }) => {
    const uniqueSuffix = Date.now()
    const email = `dup-warning-${uniqueSuffix}@example.com`

    // Seed the "original" customer directly via API — faster than driving
    // the UI twice, and this test is about the warning, not creation itself.
    const seedRes = await page.request.post('/api/crm/customers', {
      data: {
        name: SEED_NAME,
        sourceChannel: 'sales',
        email,
        phone: `+637${uniqueSuffix.toString().slice(-9)}`,
      },
    })
    const seeded = await seedRes.json()
    createdIds.push(seeded.id)

    await gotoReady(page, '/crm/customers/new')

    // Retry the whole fill+check cycle, not just the fill — the unified
    // CustomerForm (Create+Edit merged into one component) is heavier than
    // the old create-only form, which widened the same dev-mode hydration
    // race fillAllStable's own doc comment describes: a reconciliation that
    // lands after these fields are entered but before the debounced
    // duplicate-check banner has a chance to appear can silently wipe them.
    await expect(async () => {
      await fillAllStable([
        { locator: page.getByLabel('First name *'), value: 'E2E' },
        { locator: page.getByLabel('Last name *'), value: `DupWarning${uniqueSuffix}` },
        { locator: page.getByLabel('Email'), value: email },
      ])
      // PhoneInput reformats its display value, so it can't go through
      // fillAllStable's exact-value check — filled separately, still inside
      // this same retry so a hydration wipe re-fills it along with the rest.
      await fillPhoneStable(
        page.locator('.phone-input-field'),
        `9${uniqueSuffix.toString().slice(-9)}`
      )
      await expect(page.getByText(/already has this email/)).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 20_000 })
    await expect(page.getByText('Original Duplicate Owner')).toBeVisible()

    // Dismissible — closing it doesn't block the form.
    await page.getByLabel('Dismiss duplicate warning').click()
    await expect(page.getByText(/already has this email/)).not.toBeVisible()

    // Re-verify/re-fill all three fields together right before submit — the
    // duplicate-check round trip above is exactly the kind of later
    // hydration reconciliation fillAllStable's own doc comment warns can
    // silently wipe an earlier-filled field before this point.
    await fillAllStable([
      { locator: page.getByLabel('First name *'), value: 'E2E' },
      { locator: page.getByLabel('Last name *'), value: `DupWarning${uniqueSuffix}` },
      { locator: page.getByLabel('Email'), value: email },
    ])
    await fillPhoneStable(
      page.locator('.phone-input-field'),
      `9${uniqueSuffix.toString().slice(-9)}`
    )

    // Still allowed to submit despite the flagged duplicate.
    await expect(async () => {
      await page.getByRole('button', { name: 'Create customer' }).click()
      await expect(page).toHaveURL(/\/crm\/customers\/[a-f0-9-]+$/, { timeout: 8_000 })
    }).toPass({ timeout: 20_000 })

    const newId = page.url().match(/\/crm\/customers\/([a-f0-9-]+)$/)?.[1]
    if (newId) createdIds.push(newId)
  })
})
