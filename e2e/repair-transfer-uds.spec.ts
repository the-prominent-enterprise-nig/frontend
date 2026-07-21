import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 07 (Repair Transfer) — Part 1: UnitDocumentSheet extended with an
// RFS-form file attachment and a repair provider (reused Supplier), plus a
// searchable Units serial picker (SearchableSelect over the already-loaded
// in-stock serials, replacing the plain <select>). Part 2: raising a repair
// UDS at a non-main branch auto-pairs a draft stock transfer to main. Also
// covers the read-only detail view (row click) and the redesigned
// card-based status-update UX. No UDS delete endpoint exists (same tradeoff
// inventory-stock-adjustment.spec.ts accepts for adjustment fixtures), so
// created records are left in place — which means the shared dev database
// accumulates rows across runs *and* the user's own manual testing in a
// separate browser session can create rows concurrently. Never assume the
// row you just created is still `.first()` by the time you check on it —
// capture its code right after creation and scope all later lookups to that
// code, same precedent inventory-stock-adjustment.spec.ts already documents.
async function getNewestRowCode(page: Page): Promise<string> {
  return page.locator('tbody tr').first().locator('td').first().innerText()
}

function rowByCode(page: Page, code: string) {
  return page.locator('tbody tr').filter({ hasText: code })
}

test.describe('Repair Transfer — Issue UDS with RFS form + repair provider', () => {
  test('Business Owner issues a repair UDS with an RFS form and repair provider', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')

    const modalHeading = page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
    await clickStable(page.getByRole('button', { name: 'Issue UDS' }), modalHeading)

    const form = page.locator('form')

    // Reason defaults to "repair" — the Repair Provider / RFS Form fields
    // should already be visible without touching the Reason select. Both
    // labels render with a trailing "(optional)" span, so this can't use
    // exact text matching — the `form` scope alone is enough to avoid
    // colliding with the list table's "Repair Provider" column header.
    const repairProviderSelect = form.getByText('Repair Provider').locator('..').locator('select')
    // The file <input> itself is visually hidden (className="hidden") behind
    // a styled, clickable <label> — assert the label, not the input, is
    // visible; setInputFiles works on a hidden input regardless.
    const rfsFileInput = form.getByText('RFS Form').locator('..').locator('input[type="file"]')
    await expect(repairProviderSelect).toBeVisible()
    await expect(form.getByText('Attach supporting document')).toBeVisible()

    const warehouseSelect = form
      .getByText('Warehouse', { exact: true })
      .locator('..')
      .locator('select')
    await warehouseSelect.selectOption({ index: 1 })

    // Units' serial picker is a SearchableSelect (type-ahead over the
    // already-loaded in-stock serials), not a native <select> — open it,
    // narrow by typing a substring of the first option's own label, and
    // confirm the list actually filters down before picking it.
    const serialInput = form.locator('input[placeholder="Search serial number…"]')
    const serialCombobox = serialInput.locator('..').locator('..')
    await serialInput.click()
    const firstOption = serialCombobox.locator('button').first()
    await expect(firstOption).toBeVisible({ timeout: 10_000 })
    const optionCountBeforeSearch = await serialCombobox.locator('button').count()
    const searchTerm = (await firstOption.innerText()).slice(0, 6)

    await serialInput.fill(searchTerm)
    await expect(async () => {
      const count = await serialCombobox.locator('button').count()
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThanOrEqual(optionCountBeforeSearch)
    }).toPass({ timeout: 5_000 })
    for (const text of await serialCombobox.locator('button').allInnerTexts()) {
      expect(text.toLowerCase()).toContain(searchTerm.toLowerCase())
    }
    await serialCombobox.locator('button').first().click()

    await repairProviderSelect.selectOption({ index: 1 })
    const providerLabel = await repairProviderSelect.locator('option:checked').innerText()
    const providerName = providerLabel.split('—').slice(1).join('—').trim()

    await rfsFileInput.setInputFiles(path.join(__dirname, 'fixtures', 'rfs-form-sample.txt'))
    await expect(form.getByText('rfs-form-sample.txt')).toBeVisible({ timeout: 10_000 })

    await expect(async () => {
      await form.getByRole('button', { name: 'Issue UDS' }).click()
      await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })

    await expect(modalHeading).toBeHidden({ timeout: 10_000 })

    // Capture this UDS's own code immediately — the newest row is `.first()`
    // right now, but the shared dev database (other runs, or the developer's
    // own manual testing in a separate browser tab) can push it down later.
    const code = await getNewestRowCode(page)
    const row = rowByCode(page, code)
    await expect(row).toContainText(providerName, { timeout: 10_000 })
    await expect(row.locator('svg.lucide-paperclip')).toBeVisible()

    // The row itself opens the detail view; "Update" is a distinct action
    // that must not also trigger it (stopPropagation on the button's click).
    await row.getByRole('button', { name: 'Update' }).click()
    const updateHeading = page.getByRole('heading', { name: 'Update UDS Status' })
    await expect(updateHeading).toBeVisible({ timeout: 10_000 })
    // exact: true matters here — the page's own H1 "Unit Document Sheets"
    // (plural) is a substring-match of this H2 under Playwright's default
    // fuzzy name matching, and is always on screen regardless of modal state.
    const detailHeading = page.getByRole('heading', { name: 'Unit Document Sheet', exact: true })
    await expect(detailHeading).toBeHidden()
    // Only the Update modal is open at this point, so its close (X) button is
    // the sole svg.lucide-x button on screen — no need to scope further.
    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-x') })
      .click()
    await expect(updateHeading).toBeHidden({ timeout: 10_000 })

    // Now click the row itself — should open the detail view with the RFS
    // form download link and repair provider info this test just set.
    // Scoped via the modal card's own max-w-3xl class (unique on this page at
    // this moment — CreateUdsModal uses max-w-2xl) rather than walking up
    // from the heading, since the background list row shows the same
    // provider name/unit count and would otherwise collide.
    await row.click()
    await expect(detailHeading).toBeVisible({ timeout: 10_000 })
    const detailModal = page.locator('div.max-w-3xl')
    await expect(detailModal).toHaveCount(1)
    await expect(detailModal.getByText(providerName)).toBeVisible()
    const downloadLink = detailModal.getByRole('link', { name: /rfs-form-sample\.txt/ })
    await expect(downloadLink).toBeVisible()
    await expect(downloadLink).toHaveAttribute('target', '_blank')
    await expect(detailModal.locator('tbody tr')).toHaveCount(1)

    await detailModal.getByRole('button', { name: 'Close' }).click()
    await expect(detailHeading).toBeHidden({ timeout: 10_000 })
  })

  // Part 2: raising a repair UDS at a non-main branch auto-pairs a draft
  // stock transfer to the tenant's main branch (Manila HQ, seeded as
  // Branch.isMainBranch) — this test picks Cebu's warehouse explicitly by
  // filtering the option text, rather than assuming an index, specifically
  // to exercise the non-main path.
  test('issuing a repair UDS at a non-main branch surfaces the auto-paired draft transfer', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')

    const modalHeading = page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
    await clickStable(page.getByRole('button', { name: 'Issue UDS' }), modalHeading)

    const form = page.locator('form')
    const warehouseSelect = form
      .getByText('Warehouse', { exact: true })
      .locator('..')
      .locator('select')
    const cebuOption = warehouseSelect.locator('option').filter({ hasText: 'Cebu' })
    await expect(cebuOption).toHaveCount(1)
    const cebuLabel = await cebuOption.innerText()
    await warehouseSelect.selectOption({ label: cebuLabel })

    const serialInput = form.locator('input[placeholder="Search serial number…"]')
    const serialCombobox = serialInput.locator('..').locator('..')
    await serialInput.click()
    const firstOption = serialCombobox.locator('button').first()
    await expect(firstOption).toBeVisible({ timeout: 10_000 })
    await firstOption.click()

    await expect(async () => {
      await form.getByRole('button', { name: 'Issue UDS' }).click()
      await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(modalHeading).toBeHidden({ timeout: 10_000 })

    const code = await getNewestRowCode(page)
    const row = rowByCode(page, code)
    const transferBadge = row.locator('a', { hasText: 'TRF-' })
    await expect(transferBadge).toBeVisible({ timeout: 10_000 })
    await expect(transferBadge).toContainText('Draft')
    await expect(transferBadge).toHaveAttribute('href', '/inventory/transfers')
  })

  // Status update UX: card-based picker (replacing the old plain <select>)
  // plus a two-step confirmation before cancelling (mirrors
  // TransferDetailModal's confirm-before-cancel pattern for consistency).
  test('updating status: card picker selection and two-step cancel confirmation', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')

    const modalHeading = page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
    await clickStable(page.getByRole('button', { name: 'Issue UDS' }), modalHeading)

    const form = page.locator('form')
    const warehouseSelect = form
      .getByText('Warehouse', { exact: true })
      .locator('..')
      .locator('select')
    await warehouseSelect.selectOption({ index: 1 })

    const serialInput = form.locator('input[placeholder="Search serial number…"]')
    const serialCombobox = serialInput.locator('..').locator('..')
    await serialInput.click()
    await expect(serialCombobox.locator('button').first()).toBeVisible({ timeout: 10_000 })
    await serialCombobox.locator('button').first().click()

    await expect(async () => {
      await form.getByRole('button', { name: 'Issue UDS' }).click()
      await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(modalHeading).toBeHidden({ timeout: 10_000 })

    const code = await getNewestRowCode(page)
    const row = rowByCode(page, code)
    await row.getByRole('button', { name: 'Update' }).click()

    const updateHeading = page.getByRole('heading', { name: 'Update UDS Status' })
    await expect(updateHeading).toBeVisible({ timeout: 10_000 })

    // "issued" allows ["in_transit", "cancelled"] — both should render as
    // clickable cards, not a native <select>.
    const inTransitCard = page.getByRole('button', { name: /In Transit/ })
    const cancelledCard = page.getByRole('button', { name: /Cancelled/ })
    await expect(inTransitCard).toBeVisible()
    await expect(cancelledCard).toBeVisible()

    const submitButton = page.getByRole('button', { name: 'Update Status' })

    // Selecting "In Transit" shows the neutral submit label, not the cancel warning.
    await inTransitCard.click()
    await expect(page.getByText(/cannot be undone/)).toHaveCount(0)
    await expect(submitButton).toBeVisible()

    // Selecting "Cancelled" — first submit only reveals the warning + relabels
    // the button; nothing is actually updated yet (two-step confirmation).
    await cancelledCard.click()
    await page.getByRole('button', { name: 'Update Status' }).click()
    await expect(page.getByText(/cannot be undone/)).toBeVisible({ timeout: 5_000 })
    const confirmButton = page.getByRole('button', { name: 'Confirm Cancel' })
    await expect(confirmButton).toBeVisible()

    await expect(async () => {
      await confirmButton.click()
      await expect(page.getByText('Status updated').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(updateHeading).toBeHidden({ timeout: 10_000 })

    await expect(row.locator('span', { hasText: 'Cancelled' })).toBeVisible({ timeout: 10_000 })
    // Cancelled is a closed state — the row's Update action goes away.
    await expect(row.getByRole('button', { name: 'Update' })).toHaveCount(0)
  })
})
