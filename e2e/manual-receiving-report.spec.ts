import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, fillStable } from './utils'

/**
 * The warehouse list re-renders once its query resolves (loading → loaded),
 * which can detach an option between opening the dropdown and clicking it.
 * Retries the whole open+click as one unit rather than trying to time the
 * two steps separately.
 */
async function pickSearchableOption(
  page: Page,
  triggerPlaceholder: string,
  optionText: string | RegExp
): Promise<void> {
  await expect(async () => {
    await page.getByPlaceholder(triggerPlaceholder).click()
    await page
      .locator('[data-testid="searchable-select-option"]')
      .filter({ hasText: optionText })
      .first()
      .click({ timeout: 3_000 })
  }).toPass({ timeout: 40_000 })
}

// Scenario 53 — rebuilt from RR-05's single-item/submit-then-approve shape
// (Scenario 29) into a multi-line, draft-then-post document mirroring the
// normal Create Receiving Report screen. Real differences from that normal
// flow: a line's item may be "Something else" (a typed name, not a catalog
// pick — resolved into a brand-new Item only once the report is posted),
// and there's no approval gate — the same person who saves the draft posts
// it themselves, whenever ready.
//
// Covers: Business Owner creates a draft with one catalog line and one
// "Something else" line, saves it (lands on the detail page as "Draft"),
// then posts it themselves (no second approver) and sees it flip to
// "Posted" with both lines shown.

test('Business Owner creates a multi-line draft (catalog + Something else) and posts it themselves', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const uniqueName = `E2E Ad-Hoc Widget ${Date.now()}`

  await gotoReady(page, '/accounting/receiving-reports')
  // The TanStack Query devtools floating toggle (dev-only) sits over the
  // sticky footer's action buttons and intercepts clicks — same fix already
  // used in inventory-price-use-types.spec.ts.
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
  // A single click, not clickStable's retry-click pattern: a cold Next dev
  // compile of a never-before-loaded route can take well over 1s, and
  // re-clicking the same link mid-transition risks a second push onto the
  // history stack rather than just missing the first click.
  await page.getByRole('link', { name: 'Create Receipt' }).click()
  await expect(page).toHaveURL(/\/accounting\/receiving-reports\/manual-rr\/new$/, {
    timeout: 30_000,
  })
  await expect(page.getByRole('heading', { name: 'Create Receiving Report' })).toBeVisible({
    timeout: 30_000,
  })

  // ── Location ─────────────────────────────────────────────────────────────
  await pickSearchableOption(page, 'Select location…', 'Panay Warehouse')

  // ── Line 1: a catalog item ──────────────────────────────────────────────
  // Closed state is a button, not the search <input> — clicking it is what
  // puts the caret in the search (same convention as ReceiveStockModal.tsx).
  await clickStable(
    page.getByRole('button', { name: 'Search item by name or SKU…' }),
    page.getByPlaceholder('Search item by name or SKU…')
  )
  const itemInput = page.getByPlaceholder('Search item by name or SKU…')
  await fillStable(itemInput, 'TN-NIG-PART-AIR-FILTER')
  const itemOption = page.getByRole('button', { name: /TN-NIG-PART-AIR-FILTER/ }).first()
  await expect(itemOption).toBeVisible({ timeout: 10_000 })
  await itemOption.click()

  // ── Line 2: "Something else" — not in the catalog ───────────────────────
  await clickStable(
    page.getByRole('button', { name: 'Add Line' }),
    page.getByRole('button', { name: 'Something else' }).last()
  )
  await clickStable(
    page.getByRole('button', { name: 'Something else' }).last(),
    page.getByPlaceholder('What was it? e.g. "10 assorted screws"')
  )
  await fillStable(page.getByPlaceholder('What was it? e.g. "10 assorted screws"'), uniqueName)

  // ── Save the draft ───────────────────────────────────────────────────────
  await expect(async () => {
    await page.getByRole('button', { name: 'Save Draft' }).click()
    // A successful save navigates straight to the new report's own detail
    // page — there's no modal to close, no list to poll.
    await expect(page).toHaveURL(/\/accounting\/receiving-reports\/manual-rr\/[^/]+$/, {
      timeout: 15_000,
    })
  }).toPass({ timeout: 20_000 })

  // ── Confirm it landed as a draft, with both lines shown ─────────────────
  await expect(page.getByText('Draft', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('TN-NIG-PART-AIR-FILTER', { exact: false })).toBeVisible()
  await expect(page.getByText(uniqueName)).toBeVisible()

  // ── Post it — same actor, no second approver ────────────────────────────
  const postButton = page.getByRole('button', { name: 'Post' })
  await expect(postButton).toBeVisible({ timeout: 10_000 })
  await postButton.click()

  // .first(): the status badge and the success toast's title both read
  // "Posted" — either one confirms the post went through.
  await expect(page.getByText('Posted', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Post' })).toHaveCount(0)
})
