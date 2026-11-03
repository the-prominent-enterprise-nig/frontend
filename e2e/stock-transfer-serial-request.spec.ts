import { test, expect } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  pickComboboxOption,
  findStockedTransferSource,
  pickTransferSource,
} from './utils'

// Scenario 06, Part 1 — a request for a serial-tracked item names the item and
// how many units, never which physical units. The specific serials are chosen
// by the source at dispatch (see TransferDetailModal's dispatch form and the
// backend's assignDispatchSerials), since the requester can't see what's
// actually on the shelf at the other branch. A quantity of N is split into N
// single-unit lines at submit, satisfying the backend's per-line invariant
// without making the requester add the same item N times.

async function openCreateModal(page: import('@playwright/test').Page) {
  await gotoReady(page, '/inventory/transfers')
  await clickStable(
    page.getByRole('button', { name: 'New Transfer' }),
    page.getByRole('heading', { name: 'New Stock Transfer' })
  )
}

async function pickWarehouses(page: import('@playwright/test').Page): Promise<string> {
  // A source that actually holds a free serial-tracked unit — index 0 / the
  // first catalog item asked for stock the source didn't have (test DB no
  // longer seeds every item everywhere: "Not enough stock. Available: 0").
  const stocked = await findStockedTransferSource(page.request, { serialTracked: true })
  await pickTransferSource(page, stocked.sourceName)
  await pickComboboxOption(page, 'Search destination branch…')
  return stocked.sku
}

async function addSerialTrackedItem(page: import('@playwright/test').Page, sku: string) {
  // Items are added from the Items card's own "Add item" search — there is no
  // per-row item picker. SearchCombobox renders a BUTTON when closed and only
  // swaps in the search <input> once opened (see its own comment), so the
  // closed control cannot be reached with getByPlaceholder — open it first,
  // then type. Matched on a plain substring rather than the full placeholder,
  // which carries an em dash and an ellipsis character.
  await page
    .getByRole('button', { name: /Add item/ })
    .first()
    .click()
  const addInput = page.locator('input[placeholder*="Add item"]')
  await expect(addInput).toBeVisible({ timeout: 10_000 })
  await addInput.fill(sku)
  // Match on the SKU specifically, not the item name — a name substring can
  // surface sibling products (e.g. "Refrigerator Deodorizer").
  const option = page.getByRole('button', { name: new RegExp(sku) }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
  return sku
}

test.describe('Inventory — Stock Transfer serial-tracked requesting', () => {
  test('a serial-tracked line asks for a quantity, not a specific unit', async ({ page }) => {
    await openCreateModal(page)
    const sku = await pickWarehouses(page)
    await addSerialTrackedItem(page, sku)

    // The line asks for a quantity only — no serial picker anywhere in the form.
    await expect(page.getByText('Serial-tracked', { exact: false })).toHaveCount(0)
    await expect(page.getByTestId('serial-pick-panel')).toHaveCount(0)
    await expect(page.getByTestId('serial-pick-card')).toHaveCount(0)

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('creates a transfer for a serial-tracked item, then cancels it (cleanup)', async ({
    page,
  }) => {
    // Identifies this run's own transfer reliably in the list — nothing else
    // about a bulk request is unique enough to match on.
    const uniqueReason = `E2E-TRF-SERIAL-${Date.now()}`

    await openCreateModal(page)
    const sku = await pickWarehouses(page)
    await addSerialTrackedItem(page, sku)

    await page.getByPlaceholder('e.g. Rebalancing stock for upcoming campaign').fill(uniqueReason)

    // Submit can be un-hydrated for an instant after the modal mounts (same
    // hydration race fillStable/clickStable work around elsewhere) — retry
    // the click until the modal actually closes on success.
    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Request' }).click()
      await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toHaveCount(0, {
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // The newly created draft should be the most recent transfer (list is
    // sorted by createdAt desc), but the list can still be showing a
    // pre-refetch stale order for a moment right after creation — retry
    // until the opened detail's Reason actually matches this run's unique
    // marker, closing and reopening in between if a stale/wrong row opens.
    await expect(async () => {
      await page.locator('tbody tr').first().click()
      await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeVisible({
        timeout: 3_000,
      })
      const isMine = await page
        .getByText(uniqueReason, { exact: true })
        .isVisible()
        .catch(() => false)
      if (!isMine) {
        await page.getByRole('button', { name: 'Close dialog' }).click()
        throw new Error('opened transfer is not the one just created — retrying')
      }
    }).toPass({ timeout: 20_000 })

    // Cleanup: cancel the draft so repeated runs don't pile up test transfers.
    await page.getByRole('button', { name: 'Cancel Transfer' }).click()
    await page.getByRole('button', { name: 'Yes, Cancel Transfer' }).click()
    await expect(page.getByText('Cancel this transfer?')).toHaveCount(0, { timeout: 10_000 })
  })

  test('asking for several units of a serial-tracked item sends one line per unit', async ({
    page,
  }) => {
    await openCreateModal(page)
    const sku = await pickWarehouses(page)
    await addSerialTrackedItem(page, sku)

    // One UI line, three units — the split into three single-unit lines only
    // happens at submit, so the header count is what proves the intent here.
    await page.getByLabel('Units to send').fill('3')
    await expect(page.getByText('1 line · 3 units')).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })
})
