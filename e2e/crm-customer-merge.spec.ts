import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 02 (2026-07-31 update, item #3) — BM/AR Reviewer duplicate-resolution
// merge workflow. Branch Manager + Business Owner only, deliberately not
// cascaded to Cashier or other Employee-level CRM roles — exercises the real
// role boundary, not just the UI, so it opts out of the shared Business
// Owner storageState every other spec inherits.
test.use({ storageState: { cookies: [], origins: [] } })

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'technova.b1.manager@test.com'
const MARKETING_EMAIL = process.env.E2E_MARKETING_EMAIL ?? 'technova.b1.crm@test.com'
const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

test.describe('CRM — Duplicate Customer Merge (Branch Manager)', () => {
  test('reviews a flagged pair, overrides a conflicting field, and merges', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, PASSWORD)

    const uniqueSuffix = Date.now()
    const email = `merge-e2e-${uniqueSuffix}@example.com`
    const nameA = `Merge E2E Survivor ${uniqueSuffix}`
    const nameB = `Merge E2E Duplicate ${uniqueSuffix}`
    // Unique per run — a hardcoded phone would collide with a leftover
    // customer from a prior failed run and produce an unrelated extra pair.
    const phoneA = `+63917${uniqueSuffix.toString().slice(-7)}`
    const phoneB = `+63918${uniqueSuffix.toString().slice(-7)}`

    const resA = await page.request.post('/api/crm/customers', {
      data: { name: nameA, sourceChannel: 'sales', email, phone: phoneA },
    })
    const customerA = await resA.json()
    const resB = await page.request.post('/api/crm/customers', {
      data: { name: nameB, sourceChannel: 'sales', email, phone: phoneB },
    })
    const customerB = await resB.json()

    await gotoReady(page, '/crm/customers')
    await expect(page.getByRole('link', { name: 'Review Duplicates' })).toBeVisible()
    await page.getByRole('link', { name: 'Review Duplicates' }).click()
    await expect(page).toHaveURL(/\/crm\/customers\/duplicates$/)

    const pairRow = page.getByTestId(
      `duplicate-pair-${[customerA.id, customerB.id].sort().join('-')}`
    )
    await expect(pairRow).toBeVisible({ timeout: 10_000 })
    await pairRow.getByRole('button', { name: 'Compare & Merge' }).click()

    await expect(page.getByRole('heading', { name: 'Compare & merge' })).toBeVisible()
    await expect(page.getByText(nameA)).toBeVisible()
    await expect(page.getByText(nameB)).toBeVisible()

    // Pick Record B's phone value for the survivor instead of the default.
    await page.getByRole('radio').and(page.locator(`[name="field-phone"]`)).nth(1).check()

    await page.getByRole('button', { name: 'Merge customers' }).click()
    await expect(page.getByRole('heading', { name: 'Compare & merge' })).not.toBeVisible({
      timeout: 10_000,
    })

    // The merged pair no longer appears in the queue.
    await expect(page.getByText(nameB)).not.toBeVisible()

    // Survivor picked up the overridden phone value from the duplicate.
    const detailRes = await page.request.get(`/api/crm/customers/${customerA.id}`)
    const detail = await detailRes.json()
    expect(detail.phone).toBe(phoneB)

    // Old (merged) URL transparently resolves to the survivor instead of 404ing.
    const oldUrlRes = await page.request.get(`/api/crm/customers/${customerB.id}`)
    const oldUrlDetail = await oldUrlRes.json()
    expect(oldUrlDetail.id).toBe(customerA.id)

    // Visiting the old profile URL in the browser shows an explicit
    // "merged into this record" notice instead of silently swapping data.
    await gotoReady(page, `/crm/customers/${customerB.id}`)
    await expect(page.getByRole('heading', { name: nameA })).toBeVisible()
    await expect(page.getByText(/was merged into this record/)).toBeVisible()
    await expect(page.getByText(nameB, { exact: false })).toBeVisible()

    await page.request.delete(`/api/crm/customers/${customerA.id}`)
  })

  test('dismissing a pair removes it from the queue', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, PASSWORD)

    const uniqueSuffix = Date.now()
    const email = `dismiss-e2e-${uniqueSuffix}@example.com`
    const nameA = `Dismiss E2E A ${uniqueSuffix}`
    const nameB = `Dismiss E2E B ${uniqueSuffix}`

    const resA = await page.request.post('/api/crm/customers', {
      data: {
        name: nameA,
        sourceChannel: 'sales',
        email,
        phone: `+639${uniqueSuffix.toString().slice(-9)}`,
      },
    })
    const customerA = await resA.json()
    const resB = await page.request.post('/api/crm/customers', {
      data: {
        name: nameB,
        sourceChannel: 'sales',
        email,
        phone: `+638${uniqueSuffix.toString().slice(-9)}`,
      },
    })
    const customerB = await resB.json()

    await gotoReady(page, '/crm/customers/duplicates')
    const pairRow = page.getByTestId(
      `duplicate-pair-${[customerA.id, customerB.id].sort().join('-')}`
    )
    await expect(pairRow).toBeVisible({ timeout: 10_000 })
    await pairRow.getByRole('button', { name: 'Not a duplicate' }).click()
    await expect(page.getByText(nameB)).not.toBeVisible()

    // Stays dismissed on reload.
    await gotoReady(page, '/crm/customers/duplicates')
    await expect(page.getByText(nameB)).not.toBeVisible()

    await page.request.delete(`/api/crm/customers/${customerA.id}`)
    await page.request.delete(`/api/crm/customers/${customerB.id}`)
  })
})

test.describe('CRM — Duplicate Customer Merge (role boundary)', () => {
  test('Marketing Manager (crm:customers:read only) never sees Review Duplicates and is blocked from the page directly', async ({
    page,
  }) => {
    await loginAs(page, MARKETING_EMAIL, PASSWORD)

    await gotoReady(page, '/crm/customers')
    await expect(page.getByRole('link', { name: 'Review Duplicates' })).not.toBeVisible()

    await gotoReady(page, '/crm/customers/duplicates')
    await expect(page).toHaveURL(/\/403$/)
  })
})
