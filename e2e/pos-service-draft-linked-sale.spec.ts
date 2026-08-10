import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  cancelServiceDraft,
  clickStable,
  fillStable,
  findServiceDraftIdByTitle,
  gotoReady,
  sweepE2EServiceDrafts,
} from './utils'

// Deliberately does NOT contain the phrase "Linked Sale" — that string is
// also the UI label under test, and a title containing it would make
// `getByText('Linked Sale')` ambiguously match the job's own title too.
const TITLE_PREFIX = 'E2E POS-Sale-Link — '

// Business Owner (this suite's shared storageState persona) has no session
// branch, so the form's Branch field renders as an editable combobox that
// must be filled before submitting.
async function pickFirstBranch(page: Page): Promise<void> {
  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branch = branches[0]
  if (!branch) throw new Error('No seeded branch found')

  const branchInput = page.getByPlaceholder('Search branch by name…')
  await fillStable(branchInput, branch.name)
  const branchDropdown = page.locator('div.fixed.z-100')
  const branchOption = branchDropdown.getByText(branch.name, { exact: false })
  await expect(branchOption).toBeVisible({ timeout: 10_000 })
  await branchOption.click()
}

// Mirrors pickFirstBranch's exact pattern (div.fixed.z-100 portal +
// getByText) — including not re-querying `input` after the click.
// SearchCombobox sets the input's placeholder attribute to the confirmed
// label once one is picked, so a placeholder-based locator (lazily
// re-evaluated on every call) stops matching its own field right after a
// successful selection — this isn't a bug, just means "verify by placeholder"
// only works pre-pick. Later assertions (the detail view) confirm the pick
// actually took.
async function pickLinkedSale(
  page: Page,
  input: Locator,
  transactionNumber: string
): Promise<void> {
  await fillStable(input, transactionNumber)
  const dropdown = page.locator('div.fixed.z-100')
  const option = dropdown.getByText(transactionNumber, { exact: false })
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
}

// Aircool Gap 2 follow-up — linking a service job back to the POS
// transaction/invoice its aircon + install service was originally sold on.
// ServiceDraft.posTransactionId has existed since Closing Gap 2 but had no
// picker UI or display until this pass. Backend-side create/update/
// validation behavior for the field itself is covered by the "ServiceDraft
// — Linked Sale (posTransactionId) E2E" block in aircool.e2e-spec.ts; this
// spec covers the actual picker and detail-view display.
test.describe('POS Service Jobs — Linked Sale (Aircool Gap 2 follow-up)', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2EServiceDrafts(request, TITLE_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    for (const id of createdIds) await cancelServiceDraft(request, id)
    createdIds = []
  })

  test('linking a service job to a POS transaction shows it on the detail view', async ({
    page,
  }) => {
    // Any existing real transaction works — this test only proves the
    // picker searches/selects it and the link round-trips, not that a
    // specific transaction exists. Unlike the paginated inventory/
    // service-draft list endpoints, GET /pos/transactions returns a plain
    // array (no {data, total} wrapper) — see transactions.service.ts's
    // findAll(), which returns `transactions.map(...)` directly.
    const txRes = await page.request.get('/api/pos/transactions')
    const transactions = (await txRes.json()) as { id: string; transactionNumber: string }[]
    const transaction = transactions[0]
    if (!transaction) throw new Error('No existing POS transaction found to link against')

    const title = `${TITLE_PREFIX}${Date.now()}`
    await gotoReady(page, '/pos/service-jobs')
    await clickStable(
      page.getByRole('button', { name: 'New Service Job' }),
      page.getByRole('heading', { name: 'New Service Job' })
    )

    await pickFirstBranch(page)
    await fillStable(page.locator('input[placeholder*="Aircon install"]'), title)

    const linkedSaleInput = page.getByPlaceholder('Search by transaction number…')
    await pickLinkedSale(page, linkedSaleInput, transaction.transactionNumber)

    const materialInput = page.getByPlaceholder('Search material by name or SKU…')
    await fillStable(materialInput, 'Universal Remote Control')
    const materialDropdown = page.locator('div.fixed.z-100')
    await expect(
      materialDropdown.getByText('Universal Remote Control', { exact: false })
    ).toBeVisible({ timeout: 10_000 })
    await materialDropdown.getByText('Universal Remote Control', { exact: false }).click()

    // A single click, not a click-and-retry-on-toast loop: the toast is
    // transient and can fade before a tight per-attempt window catches it,
    // and once the modal has genuinely closed (creation already succeeded)
    // a retry has nothing left to click. The row appearing in the list is
    // the stable, persistent signal that actually matters.
    await page.getByRole('button', { name: 'Create Service Job' }).click()
    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 30_000 })
    const id = await findServiceDraftIdByTitle(page.request, title)
    createdIds.push(id)

    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Linked Sale')).toBeVisible()
    await expect(page.getByText(transaction.transactionNumber)).toBeVisible()
  })

  test('a service job created without a linked sale shows no Linked Sale field', async ({
    page,
  }) => {
    const title = `${TITLE_PREFIX}${Date.now()}`
    await gotoReady(page, '/pos/service-jobs')
    await clickStable(
      page.getByRole('button', { name: 'New Service Job' }),
      page.getByRole('heading', { name: 'New Service Job' })
    )

    await pickFirstBranch(page)
    await fillStable(page.locator('input[placeholder*="Aircon install"]'), title)

    const materialInput = page.getByPlaceholder('Search material by name or SKU…')
    await fillStable(materialInput, 'Universal Remote Control')
    const dropdown = page.locator('div.fixed.z-100')
    await expect(dropdown.getByText('Universal Remote Control', { exact: false })).toBeVisible({
      timeout: 10_000,
    })
    await dropdown.getByText('Universal Remote Control', { exact: false }).click()

    // A single click, not a click-and-retry-on-toast loop: the toast is
    // transient and can fade before a tight per-attempt window catches it,
    // and once the modal has genuinely closed (creation already succeeded)
    // a retry has nothing left to click. The row appearing in the list is
    // the stable, persistent signal that actually matters.
    await page.getByRole('button', { name: 'Create Service Job' }).click()
    const row = page.locator('tr').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 30_000 })
    const id = await findServiceDraftIdByTitle(page.request, title)
    createdIds.push(id)

    await row.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    // Scoped to the modal itself — the background list can contain other
    // (unrelated, e.g. leftover-cancelled) rows whose title text might
    // otherwise collide with a page-wide "Linked Sale" text search.
    const modal = page.locator('.fixed.inset-0').filter({ hasText: title })
    await expect(modal.getByText('Linked Sale')).not.toBeVisible()
  })
})
