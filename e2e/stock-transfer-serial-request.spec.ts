import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 06, Part 1 — a transfer line for a serial-tracked item must carry
// a specific serial number (mirrors POS checkout's requirement). Refrigerator
// (TN-REF-001) is seeded with 200 in-stock serials per warehouse specifically
// so e2e/manual testing never runs low (see prisma/seed.ts "Variant item
// serials"). Item/serial pickers are searchable comboboxes (ItemSearchCombobox
// / SerialSearchCombobox), not native <select>s.

async function openCreateModal(page: import('@playwright/test').Page) {
  await gotoReady(page, '/inventory/transfers')
  await clickStable(
    page.getByRole('button', { name: 'New Transfer' }),
    page.getByRole('heading', { name: 'New Stock Transfer' })
  )
}

async function pickWarehouses(page: import('@playwright/test').Page) {
  const modalForm = page.locator('form')
  const fromSelect = modalForm.locator('select').nth(0)
  const toSelect = modalForm.locator('select').nth(1)
  await fromSelect.selectOption({ index: 1 })
  await toSelect.selectOption({ index: 1 })
}

async function pickRefrigerator(page: import('@playwright/test').Page) {
  // Once an option is selected, SearchCombobox's own placeholder attribute
  // changes to the confirmed label text — so re-querying by the original
  // "Search item…" placeholder afterward would legitimately find nothing.
  // The "Specific serial number" section appearing (asserted by callers) is
  // the meaningful confirmation that the right (serial-tracked) item landed.
  const itemInput = page.getByPlaceholder('Search item')
  await itemInput.click()
  await itemInput.fill('TN-REF-001')
  // Match on the SKU specifically, not "Refrigerator" — the search also
  // surfaces "Refrigerator Deodorizer" (TN-CLN-REFDEODORIZER), which contains
  // that same substring in its name.
  const option = page.getByRole('button', { name: /TN-REF-001/ }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
}

test.describe('Inventory — Stock Transfer serial-level requesting', () => {
  test('creates a transfer with a specific serial, shows it on the detail view, then cancels it (cleanup)', async ({
    page,
  }) => {
    // Identifies this run's own transfer reliably in the list — the serial
    // picker deterministically selects the same physical serial every run
    // (always the first option), so matching on serial text alone can't
    // distinguish this run's draft from an older, already-cancelled one that
    // happened to reference the same serial.
    const uniqueReason = `E2E-TRF-SERIAL-${Date.now()}`

    await openCreateModal(page)
    await pickWarehouses(page)
    await pickRefrigerator(page)

    await expect(page.getByText('Specific serial number')).toBeVisible()
    const serialInput = page.getByPlaceholder('Search serial number…')
    // The serial list is fetched fresh (scoped to the chosen item + source
    // warehouse) once both are picked — wait for the field to actually
    // become interactive before opening it.
    await expect(serialInput).toBeEnabled({ timeout: 10_000 })
    await serialInput.click()
    const serialOption = page.locator('button', { hasText: /^REF-001-/ }).first()
    await expect(serialOption).toBeVisible({ timeout: 10_000 })
    // Capture the text before clicking — same placeholder-staleness issue as
    // the item input: selecting an option changes SearchCombobox's own
    // placeholder to the confirmed label, so reading it back afterward via
    // the original "Search serial number…" locator would find nothing.
    const serialText = (await serialOption.textContent())?.trim() ?? ''
    expect(serialText).toMatch(/^REF-001-/)
    await serialOption.click()

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

    await expect(page.getByText(serialText, { exact: true })).toBeVisible()

    // Cleanup: cancel the draft so repeated runs don't pile up test transfers.
    await page.getByRole('button', { name: 'Cancel Transfer' }).click()
    await page.getByRole('button', { name: 'Yes, Cancel Transfer' }).click()
    await expect(page.getByText('Cancel this transfer?')).toHaveCount(0, { timeout: 10_000 })
  })

  test('blocks Submit Request with a required-field error when no serial is picked for a serial-tracked item', async ({
    page,
  }) => {
    await openCreateModal(page)
    await pickWarehouses(page)
    await pickRefrigerator(page)

    await expect(page.getByText('Specific serial number')).toBeVisible()
    // Deliberately leave the serial field untouched, then try to submit.
    await page.getByRole('button', { name: 'Submit Request' }).click()

    await expect(page.getByText('This field is required')).toBeVisible({ timeout: 10_000 })
    // Modal must stay open — nothing should have been created.
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('serial field prompts for a warehouse first when none is picked yet', async ({ page }) => {
    await openCreateModal(page)
    await pickRefrigerator(page)

    await expect(page.getByText('Specific serial number')).toBeVisible()
    const serialInput = page.getByPlaceholder('Please select a warehouse first')
    await expect(serialInput).toBeVisible()
    await expect(serialInput).toBeDisabled()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })
})
