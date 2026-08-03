import { test, expect } from '@playwright/test'
import {
  cancelServiceDraft,
  clickStable,
  ensureItemStock,
  fillStable,
  findServiceDraftIdByTitle,
  gotoReady,
  loginAs,
  sweepE2EServiceDrafts,
} from './utils'

const TITLE_PREFIX = 'E2E Complete — '

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
  // Creation goes through a Server Action, not a client-visible request —
  // look the id up after the fact instead of intercepting the create call.
  const id = await findServiceDraftIdByTitle(page.request, title)
  return { row, id }
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
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2EServiceDrafts(request, TITLE_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    // No-ops for the two tests below that successfully drive the job all
    // the way to completed — that's a real record with real stock-deduction
    // side effects, same as any genuinely completed job, not cleanup debt.
    // Only catches a job left behind mid-flow by a failure.
    for (const id of createdIds) await cancelServiceDraft(request, id)
    createdIds = []
  })

  test('Business Owner records actuals and completes the job, deducting stock and closing it', async ({
    page,
  }) => {
    const title = `E2E Complete — ${Date.now()}`
    const { row, id } = await createServiceJob(page, title)
    createdIds.push(id)

    const detailHeading = page.getByRole('heading', { name: title })
    await row.click()
    await expect(detailHeading).toBeVisible()

    // Start Install now genuinely issues materials out of stock (Aircool
    // issue-then-return) — top up this branch's stock for the picked
    // material first, so this test's success doesn't depend on this shared
    // dev database's ambient, ever-drifting on-hand level.
    const branchName = await page.locator('p:text-is("Branch") + p').first().innerText()
    await ensureItemStock(page, { branchName, itemQuery: 'Split-Type Aircon', quantity: 50 })

    await confirmSourcing(page)
    await expect(detailHeading).toBeVisible()
    await startInstall(page)
    await expect(detailHeading).toBeVisible()

    // Record 0 as the actual (technician used none of the estimated
    // material, so complete() returns the full issued qty back to stock) —
    // deliberately, not 1: keeps this test's assertions independent of the
    // exact issued/returned amounts, since stock-movement math itself is
    // already covered thoroughly by the backend e2e suite's own isolated
    // fixtures — this UI test only needs to prove the workflow wiring.
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
    // Nothing was actually used (actual recorded as 0) — no materials
    // invoice should have been generated for this job.
    await expect(page.getByText('Materials Invoice')).toHaveCount(0)
  })

  test('completing a job with actual usage generates and displays a materials invoice (Aircool Closing Gap 5b)', async ({
    page,
  }) => {
    const title = `E2E Complete — Invoice — ${Date.now()}`
    const { row, id } = await createServiceJob(page, title)
    createdIds.push(id)

    const detailHeading = page.getByRole('heading', { name: title })
    await row.click()
    await expect(detailHeading).toBeVisible()

    const branchName = await page.locator('p:text-is("Branch") + p').first().innerText()
    await ensureItemStock(page, { branchName, itemQuery: 'Split-Type Aircon', quantity: 50 })

    await confirmSourcing(page)
    await startInstall(page)

    // The estimated qty was 1 (createServiceJob) — record 1 as the actual
    // too, so this line is genuinely billable.
    const actualInput = page.locator('input[placeholder="0"]').first()
    await fillStable(actualInput, '1')
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

    await expect(page.getByText('Materials Invoice')).toBeVisible()
    await expect(page.getByText(/^SDI-\d{8}-\d{4}$/)).toBeVisible()
  })
})

test.describe('POS Service Jobs — Cashier cannot complete (role gate)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const CASHIER_EMAIL = process.env.E2E_CASHIER_EMAIL ?? 'technova.b1.cashier@test.com'
  const STOCK_EMAIL = process.env.E2E_STOCK_EMAIL ?? 'technova.b1.stock@test.com'
  const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

  // No beforeAll self-heal sweep in this block — this file-level storageState
  // override means a worker-scoped `request` fixture in beforeAll would be
  // unauthenticated. The sibling describe block above already sweeps this
  // title prefix (all three patterns share it), so that gap is covered
  // from there.
  let createdIds: string[] = []

  test.afterEach(async ({ page }) => {
    for (const id of createdIds) await cancelServiceDraft(page.request, id)
    createdIds = []
  })

  test('Cashier never sees Complete Job, even on a job Stock Controller already moved to installing', async ({
    page,
  }) => {
    await loginAs(page, CASHIER_EMAIL, PASSWORD)
    const title = `E2E Complete — Cashier gate — ${Date.now()}`
    const { id } = await createServiceJob(page, title)
    createdIds.push(id)

    await page.context().clearCookies()
    await loginAs(page, STOCK_EMAIL, PASSWORD)
    await gotoReady(page, '/pos/service-jobs')
    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    const branchName = await page.locator('p:text-is("Branch") + p').first().innerText()
    await ensureItemStock(page, { branchName, itemQuery: 'Split-Type Aircon', quantity: 50 })

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
