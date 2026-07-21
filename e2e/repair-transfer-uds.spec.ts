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
async function getNewestRowCode(page: Page): Promise<string | null> {
  const count = await page.locator('tbody tr').count()
  if (count === 0) return null
  return page
    .locator('tbody tr')
    .first()
    .locator('td')
    .first()
    .locator('span.font-mono')
    .innerText()
}

function rowByCode(page: Page, code: string) {
  return page.locator('tbody tr').filter({ hasText: code })
}

// gotoReady only waits for domcontentloaded, not the client-side list fetch
// — right after navigation the table can still be the loading skeleton (zero
// <tr>s, same as a genuinely empty result), so a bare row-count check can't
// tell "still loading" apart from "done loading, zero rows" (e.g. right
// after a fresh seed/reset). Settle on either a real row appearing or the
// list's own empty-state message, so callers get an accurate "previous"
// snapshot — including a legitimate null — instead of retrying forever
// whenever the table starts out empty.
async function isListSettled(page: Page): Promise<boolean> {
  if ((await page.locator('tbody tr').count()) > 0) return true
  return page.getByText('No Unit Document Sheets found').isVisible()
}

async function getSettledNewestRowCode(page: Page): Promise<string | null> {
  let code: string | null = null
  await expect(async () => {
    expect(await isListSettled(page)).toBe(true)
    code = await getNewestRowCode(page)
  }).toPass({ timeout: 10_000 })
  return code
}

// The create modal's onSuccess closes it immediately, but the list's
// invalidateQueries refetch is async and isn't guaranteed to have landed by
// then — reading "the newest row" right after the modal closes can still
// return the *previous* top row. Capture the pre-creation top row's code
// first, then poll until the top row's code actually changes, so we never
// hand back a stale code and silently operate on the wrong UDS downstream.
async function waitForNewRowCode(page: Page, previousCode: string | null): Promise<string> {
  const captured: { code: string | null } = { code: null }
  await expect(async () => {
    const code = await getNewestRowCode(page)
    expect(code).not.toBeNull()
    expect(code).not.toBe(previousCode)
    captured.code = code
  }).toPass({ timeout: 10_000 })
  return captured.code as string
}

test.describe('Repair Transfer — Issue UDS with RFS form + repair provider', () => {
  test('Business Owner issues a repair UDS with an RFS form and repair provider', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')
    const previousCode = await getSettledNewestRowCode(page)

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

    // Defensive re-verify/reapply on each retry attempt — cheap insurance
    // against losing either field to a lost click, independent of the
    // separate newest-row-capture race documented at waitForNewRowCode.
    const rfsFileLabel = form.getByText('rfs-form-sample.txt')
    await expect(async () => {
      if ((await repairProviderSelect.inputValue()) === '') {
        await repairProviderSelect.selectOption({ index: 1 })
      }
      if (!(await rfsFileLabel.isVisible().catch(() => false))) {
        await rfsFileInput.setInputFiles(path.join(__dirname, 'fixtures', 'rfs-form-sample.txt'))
      }
      await expect(repairProviderSelect).not.toHaveValue('')
      await expect(rfsFileLabel).toBeVisible({ timeout: 3_000 })
      await form.getByRole('button', { name: 'Issue UDS' }).click()
      await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })

    await expect(modalHeading).toBeHidden({ timeout: 10_000 })

    // Capture this UDS's own code immediately — the newest row is `.first()`
    // right now, but the shared dev database (other runs, or the developer's
    // own manual testing in a separate browser tab) can push it down later.
    const code = await waitForNewRowCode(page, previousCode)
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
    const previousCode = await getSettledNewestRowCode(page)

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

    const code = await waitForNewRowCode(page, previousCode)
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
    const previousCode = await getSettledNewestRowCode(page)

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

    const code = await waitForNewRowCode(page, previousCode)
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

    // .rounded-full scopes to the actual badge span, not the flex wrapper
    // around it (which also "has" the same text and would otherwise be a
    // second match under Playwright's strict mode).
    await expect(row.locator('span.rounded-full', { hasText: 'Cancelled' })).toBeVisible({
      timeout: 10_000,
    })
    // Cancelled is a closed state — the row's Update action goes away.
    await expect(row.getByRole('button', { name: 'Update' })).toHaveCount(0)
  })

  // Part 3: assessing a received repair UDS as repairable posts a debit to
  // the repair provider (Dr REPAIR_EXPENSE / Cr REPAIR_PROVIDER_PAYABLE) and
  // surfaces the verdict + cost + "debit posted" in both the list row and
  // the detail view.
  test('assessing a received repair UDS as repairable records the verdict and debit', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/uds')
    const previousCode = await getSettledNewestRowCode(page)

    const modalHeading = page.getByRole('heading', { name: 'Issue Unit Document Sheet' })
    await clickStable(page.getByRole('button', { name: 'Issue UDS' }), modalHeading)

    const form = page.locator('form')
    const warehouseSelect = form
      .getByText('Warehouse', { exact: true })
      .locator('..')
      .locator('select')
    await expect(async () => {
      await warehouseSelect.selectOption({ index: 1 })
      await expect(warehouseSelect).not.toHaveValue('')
    }).toPass({ timeout: 10_000 })

    const serialInput = form.locator('input[placeholder="Search serial number…"]')
    const serialCombobox = serialInput.locator('..').locator('..')
    await serialInput.click()
    await expect(serialCombobox.locator('button').first()).toBeVisible({ timeout: 10_000 })
    await serialCombobox.locator('button').first().click()

    const repairProviderSelect = form.getByText('Repair Provider').locator('..').locator('select')
    await expect(async () => {
      await repairProviderSelect.selectOption({ index: 1 })
      await expect(repairProviderSelect).not.toHaveValue('')
      await form.getByRole('button', { name: 'Issue UDS' }).click()
      await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await expect(modalHeading).toBeHidden({ timeout: 10_000 })

    // waitForNewRowCode (not a bare read of the top row) matters here: the
    // create modal's onSuccess closes it before the list's invalidateQueries
    // refetch is guaranteed to have landed, so reading "the newest row"
    // immediately after close can still return the *previous* top row —
    // this was the actual cause of an earlier-observed "repairProviderId
    // sometimes missing" symptom (it wasn't missing; the assertions were
    // silently checking a different, older UDS).
    const code = await waitForNewRowCode(page, previousCode)
    const row = rowByCode(page, code)

    // issued -> in_transit -> received: assess() requires 'received', and
    // 'received' isn't directly reachable from 'issued' (matches the
    // backend's ALLOWED_TRANSITIONS state machine).
    for (const nextStatus of ['In Transit', 'Received']) {
      await row.getByRole('button', { name: 'Update' }).click()
      const updateHeading = page.getByRole('heading', { name: 'Update UDS Status' })
      await expect(updateHeading).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: new RegExp(nextStatus) }).click()
      await expect(async () => {
        await page.getByRole('button', { name: 'Update Status' }).click()
        await expect(page.getByText('Status updated').first()).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 15_000 })
      await expect(updateHeading).toBeHidden({ timeout: 10_000 })
    }

    const assessButton = row.getByRole('button', { name: 'Assess' })
    await expect(assessButton).toBeVisible({ timeout: 10_000 })
    await assessButton.click()

    const assessHeading = page.getByRole('heading', { name: 'Assess Repair Transfer' })
    await expect(assessHeading).toBeVisible({ timeout: 10_000 })

    // "Repairable" is the default selection — the estimated-cost field and
    // its "no repair provider on file" warning should already be visible.
    await expect(page.getByRole('button', { name: /Repairable/ })).toBeVisible()
    const costInput = page.locator('input[type="number"]')
    await expect(costInput).toBeVisible()
    await expect(page.getByText(/no repair provider is on file/i)).toHaveCount(0)
    await costInput.fill('2500')

    await expect(async () => {
      await page.getByRole('button', { name: 'Confirm Assessment' }).click()
      await expect(page.getByText('UDS assessed').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(assessHeading).toBeHidden({ timeout: 10_000 })

    // Row: verdict badge visible, Assess action gone (already assessed).
    await expect(row.locator('span.rounded-full', { hasText: 'Repairable' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(row.getByRole('button', { name: 'Assess' })).toHaveCount(0)

    // Detail view: verdict, estimated cost, and "debit posted" all surfaced.
    await row.click()
    const detailHeading = page.getByRole('heading', { name: 'Unit Document Sheet', exact: true })
    await expect(detailHeading).toBeVisible({ timeout: 10_000 })
    // Regex, not an exact string — the currency symbol Intl.NumberFormat
    // renders for 'en-PH'/PHP can vary slightly by ICU data (₱ vs "PHP"), so
    // this only pins the part that matters: the amount and the "estimated"/
    // "debit posted" wording.
    const detailModal = page.locator('div.max-w-3xl')
    await expect(detailModal.getByText(/2,500\.00 estimated/)).toBeVisible()
    await expect(detailModal.getByText(/debit posted/)).toBeVisible()
    await detailModal.getByRole('button', { name: 'Close' }).click()
    await expect(detailHeading).toBeHidden({ timeout: 10_000 })
  })

  // Repair Provider can only be chosen at issue time in the create form —
  // this covers the follow-up path to set it afterwards from the detail view
  // (e.g. a UDS issued without one, or one that needs correcting).
  test('sets the repair provider afterwards from the detail view', async ({ page }) => {
    await gotoReady(page, '/inventory/uds')
    const previousCode = await getSettledNewestRowCode(page)

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

    // No repair provider selected on purpose — this test covers the "issued
    // without one" recovery path.
    await expect(async () => {
      await form.getByRole('button', { name: 'Issue UDS' }).click()
      await expect(page.getByText('UDS issued').first()).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(modalHeading).toBeHidden({ timeout: 10_000 })

    const code = await waitForNewRowCode(page, previousCode)
    const row = rowByCode(page, code)
    const detailHeading = page.getByRole('heading', { name: 'Unit Document Sheet', exact: true })

    await row.click()
    await expect(detailHeading).toBeVisible({ timeout: 10_000 })
    const detailModal = page.locator('div.max-w-3xl')
    const setProviderButton = detailModal.getByRole('button', { name: 'Set provider' })
    await expect(setProviderButton).toBeVisible()
    await setProviderButton.click()

    const setProviderHeading = page.getByRole('heading', { name: 'Set Repair Provider' })
    await expect(setProviderHeading).toBeVisible({ timeout: 10_000 })
    // The detail view closes underneath so its stale (providerless) snapshot
    // isn't left showing once this modal's own mutation succeeds.
    await expect(detailHeading).toBeHidden()

    const providerSelect = page.locator('form').getByRole('combobox')
    await providerSelect.selectOption({ index: 1 })
    const providerLabel = await providerSelect.locator('option:checked').innerText()
    const providerName = providerLabel.split('—').slice(1).join('—').trim()

    await expect(async () => {
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Repair provider updated').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })
    await expect(setProviderHeading).toBeHidden({ timeout: 10_000 })

    await expect(row).toContainText(providerName, { timeout: 10_000 })

    // Detail view now shows the provider with a "Change" affordance instead.
    await row.click()
    await expect(detailHeading).toBeVisible({ timeout: 10_000 })
    await expect(detailModal.getByText(providerName)).toBeVisible()
    await expect(detailModal.getByRole('button', { name: 'Change' })).toBeVisible()
    await detailModal.getByRole('button', { name: 'Close' }).click()
    await expect(detailHeading).toBeHidden({ timeout: 10_000 })
  })
})
