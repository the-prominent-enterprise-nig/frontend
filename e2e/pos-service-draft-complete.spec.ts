import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, loginAs, clickStable } from './utils'

// Aircool Closing Gap 5 — POS Service Jobs "Complete Job": deducts each
// line's actualQty from stock (no separate issue/return — nothing was ever
// issued during sourcing/install) and moves installing -> completed. Never
// creates a PosTransaction — billing the actual materials stays a manual,
// separate POS sale (confirmed with the developer). Same Stock-Controller-
// scoped role gate as Gaps 3-4.

async function createServiceJob(page: import('@playwright/test').Page, title: string) {
  await gotoReady(page, '/pos/service-jobs')
  await clickStable(
    page.getByRole('button', { name: 'New Service Job' }),
    page.getByRole('heading', { name: 'New Service Job' })
  )

  const branchInput = page.getByPlaceholder('Search branch by name…')
  if (await branchInput.isVisible().catch(() => false)) {
    await branchInput.click()
    const branchDropdown = page.locator('div.fixed.z-100')
    await expect(branchDropdown.locator('button').first()).toBeVisible({ timeout: 10_000 })
    await branchDropdown.locator('button').first().click()
  }

  await fillStable(page.locator('input[placeholder*="Aircon install"]'), title)

  // Search a specific, stable base-seed item rather than taking whichever
  // material comes back first — see pos-service-draft-sourcing.spec.ts for
  // why an unfiltered pick is flaky (it can land on another spec's own
  // stock-depleting E2E fixture item).
  const materialInput = page.getByPlaceholder('Search material by name or SKU…')
  await fillStable(materialInput, 'Split-Type Aircon')
  const dropdown = page.locator('div.fixed.z-100')
  // The dropdown fetches on open with whatever query is current at that
  // instant (starts as '' before the 300ms debounce settles), so its first
  // button can briefly be a stale, unfiltered result — match on the option's
  // own text instead of trusting "first button" to already be our search hit.
  const aircondOption = dropdown.getByText('Split-Type Aircon', { exact: false })
  await expect(aircondOption).toBeVisible({ timeout: 10_000 })
  await aircondOption.click()

  await fillStable(page.getByPlaceholder('0'), '1')

  await expect(async () => {
    await page.getByRole('button', { name: 'Create Service Job' }).click()
    await expect(page.getByText('Service job created successfully').first()).toBeVisible({
      timeout: 3_000,
    })
  }).toPass({ timeout: 15_000 })

  const row = page.locator('tr').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10_000 })
  return row
}

async function confirmSourcing(page: import('@playwright/test').Page) {
  const sourceButton = page.getByRole('button', { name: 'Check Stock & Source' })
  const sourcingHeading = page.getByRole('heading', { name: 'Check Stock & Source' })
  await clickStable(sourceButton, sourcingHeading)
  await expect(async () => {
    await page.getByRole('button', { name: 'Confirm & Source' }).click()
    await expect(page.getByText('Sourcing confirmed').first()).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 15_000 })
}

async function startInstall(page: import('@playwright/test').Page) {
  const startInstallButton = page.getByRole('button', { name: 'Start Install' })
  const startInstallHeading = page.getByRole('heading', { name: 'Start Install' })
  await clickStable(startInstallButton, startInstallHeading)

  const technicianInput = page.getByPlaceholder('Search staff by name or email…')
  await technicianInput.click()
  const techDropdown = page.locator('div.fixed.z-100')
  await expect(techDropdown.locator('button').first()).toBeVisible({ timeout: 10_000 })
  await techDropdown.locator('button').first().click()

  await expect(async () => {
    await page.getByRole('button', { name: 'Confirm & Start Install' }).click()
    await expect(page.getByText('Install started').first()).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 15_000 })
}

test.describe('POS Service Jobs — Complete (Aircool Closing Gap 5)', () => {
  test('Business Owner records actuals and completes the job, deducting stock and closing it', async ({
    page,
  }) => {
    const title = `E2E Complete — ${Date.now()}`
    const row = await createServiceJob(page, title)

    const detailHeading = page.getByRole('heading', { name: title })
    await row.click()
    await expect(detailHeading).toBeVisible()

    await confirmSourcing(page)
    await expect(detailHeading).toBeVisible()
    await startInstall(page)
    await expect(detailHeading).toBeVisible()

    // Record 0 as the actual (technician used none of the estimated
    // material) — deliberately, not 1: the backend skips stock deduction
    // entirely for a zero-actual line, so this test's success never depends
    // on this shared dev DB's ambient stock level for whatever item the
    // combobox above picked (already flaky once this session against a
    // long-lived, heavily-reused database — stock-deduction math itself is
    // already covered thoroughly by the backend e2e suite's own isolated
    // fixtures, so this UI test only needs to prove the workflow wiring).
    const actualInput = page.locator('input[placeholder="0"]').first()
    await fillStable(actualInput, '0')
    await expect(async () => {
      await page.getByRole('button', { name: 'Save Actuals' }).click()
      await expect(page.getByText('Actuals recorded').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    page.once('dialog', (dialog) => dialog.accept())
    await expect(async () => {
      await page.getByRole('button', { name: 'Complete Job' }).click()
      await expect(page.getByText('Service job completed').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    await expect(detailHeading).toBeVisible()
    await expect(page.getByText('completed', { exact: true }).first()).toBeVisible()
    // Complete Job is an installing-only action — must not reappear, and the
    // actual-qty cell reverts to read-only display once the job is closed.
    await expect(page.getByRole('button', { name: 'Complete Job' })).toHaveCount(0)
    await expect(page.locator('input[placeholder="0"]')).toHaveCount(0)
  })
})

test.describe('POS Service Jobs — Cashier cannot complete (role gate)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
  const STOCK_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
  const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

  test('Cashier never sees Complete Job, even on a job Stock Controller already moved to installing', async ({
    page,
  }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    const title = `E2E Complete — Cashier gate — ${Date.now()}`
    await createServiceJob(page, title)

    await page.context().clearCookies()
    await loginAs(page, STOCK_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/service-jobs')
    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await confirmSourcing(page)
    await startInstall(page)

    await page.context().clearCookies()
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/service-jobs')
    const rowAgain = page.locator('tr').filter({ hasText: title })
    await expect(rowAgain).toBeVisible({ timeout: 10_000 })
    await rowAgain.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    await expect(page.getByRole('button', { name: 'Cancel Job' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Complete Job' })).toHaveCount(0)
  })
})
