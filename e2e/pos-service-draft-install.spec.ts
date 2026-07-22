import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, loginAs, clickStable } from './utils'

// Aircool Closing Gap 4 — POS Service Jobs "Start Install" / actual-vs-
// estimate recording: assign a technician (POST .../start-install, sourcing
// -> installing), then record actual materials used per line (PATCH
// .../actuals, partial). Also covers the role gate — same as Gap 3's
// sourcing action, this is Stock-Controller-scoped and deliberately
// excludes Cashier.

async function createServiceJob(page: import('@playwright/test').Page, title: string) {
  await gotoReady(page, '/pos/service-jobs')
  await clickStable(
    page.getByRole('button', { name: 'New Service Job' }),
    page.getByRole('heading', { name: 'New Service Job' })
  )

  // Business Owner has no session branch, so the Branch field renders as an
  // editable combobox (branch-scoped roles like Cashier get it pre-locked
  // instead) and the backend 400s without one. Only fill it in when present.
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

  // Small qty this time — Gap 4 doesn't care about shortfall, only that the
  // job reaches sourcing.
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

test.describe('POS Service Jobs — Install (Aircool Closing Gap 4)', () => {
  test('Business Owner starts install, assigns a technician, and records actual materials', async ({
    page,
  }) => {
    const title = `E2E Install — ${Date.now()}`
    const row = await createServiceJob(page, title)

    const detailHeading = page.getByRole('heading', { name: title })
    await row.click()
    await expect(detailHeading).toBeVisible()

    await confirmSourcing(page)
    await expect(detailHeading).toBeVisible()

    const startInstallButton = page.getByRole('button', { name: 'Start Install' })
    const startInstallHeading = page.getByRole('heading', { name: 'Start Install' })
    await clickStable(startInstallButton, startInstallHeading)

    const technicianInput = page.getByPlaceholder('Search staff by name or email…')
    await technicianInput.click()
    const techDropdown = page.locator('div.fixed.z-100')
    await expect(techDropdown.locator('button').first()).toBeVisible({ timeout: 10_000 })
    const technicianLabel = await techDropdown.locator('button').first().innerText()
    await techDropdown.locator('button').first().click()

    await expect(async () => {
      await page.getByRole('button', { name: 'Confirm & Start Install' }).click()
      await expect(page.getByText('Install started').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    // Start Install modal closes; detail modal underneath now reflects the
    // result. The list row behind it also shows the same status badge, so
    // this can resolve to more than one match — .first() is enough proof.
    await expect(detailHeading).toBeVisible()
    await expect(page.getByText('installing', { exact: true }).first()).toBeVisible()
    // technicianLabel is "Name\nemail@..." (SearchCombobox's two-line option) —
    // just confirm the technician's first line (name) shows up in the detail.
    const technicianName = technicianLabel.split('\n')[0]
    await expect(page.getByText(technicianName).first()).toBeVisible()

    // Record actuals: the estimated qty was 1, so record 1 as the actual too.
    const actualInput = page.locator('input[placeholder="0"]').first()
    await fillStable(actualInput, '1')
    await expect(async () => {
      await page.getByRole('button', { name: 'Save Actuals' }).click()
      await expect(page.getByText('Actuals recorded').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    // Start Install is a sourcing-only action — it must not reappear once
    // the job has moved past sourcing.
    await expect(startInstallButton).toHaveCount(0)
  })
})

test.describe('POS Service Jobs — Cashier cannot install (role gate)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
  const STOCK_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
  const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

  test('Cashier never sees Start Install, even on a job Stock Controller already moved to sourcing', async ({
    page,
  }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    const title = `E2E Install — Cashier gate — ${Date.now()}`
    await createServiceJob(page, title)

    // Same branch (Manila HQ) as the Cashier, so the Stock Controller's own
    // branch-scoped list shows this same draft — switch identity in-place
    // rather than a second persisted storage-state file for one check.
    // loginAs assumes a fresh, unauthenticated session (visiting /login
    // while already signed in just redirects away) — clear cookies first so
    // each subsequent loginAs call actually lands on the login form.
    await page.context().clearCookies()
    await loginAs(page, STOCK_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/service-jobs')
    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await confirmSourcing(page)

    // Back to Cashier — the same job is now in sourcing, but Start Install
    // must still be absent for them.
    await page.context().clearCookies()
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/service-jobs')
    const rowAgain = page.locator('tr').filter({ hasText: title })
    await expect(rowAgain).toBeVisible({ timeout: 10_000 })
    await rowAgain.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    await expect(page.getByRole('button', { name: 'Cancel Job' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Install' })).toHaveCount(0)
  })
})
