import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, pickComboboxOption } from './utils'

// Scenario 06, Part 1 (reworked) — a request for a serial-tracked item names
// the exact units it sends. The line shows the source's free in-stock
// serials; the unit count is the pick itself. Each picked serial goes out as
// its own single-unit line carrying serialNumberId, which dispatch then ships
// as-is. Item 360's "Transfer selected" carries its ticked units straight in.

async function openCreateModal(page: import('@playwright/test').Page) {
  await gotoReady(page, '/inventory/transfers')
  await clickStable(
    page.getByRole('button', { name: 'New Transfer' }),
    page.getByRole('heading', { name: 'New Stock Transfer' })
  )
}

async function pickWarehouses(page: import('@playwright/test').Page) {
  // Scenario 50 — From/To are SearchableSelect comboboxes now, not native
  // <select> elements. The destination list already excludes whatever the
  // source is set to, so index 0 of each is a valid distinct pair.
  await pickComboboxOption(page, 'Search source branch…')
  await pickComboboxOption(page, 'Search destination branch…')
}

async function addSerialTrackedItem(page: import('@playwright/test').Page) {
  // Resolve a real serial-tracked item instead of naming an SKU. This helper
  // used to hardcode TN-REF-001, which is no longer in the seed — the third
  // stale SKU found in this directory, after TN-FURN-SET-001 and TN-FAN-001.
  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { limit: '100', lifecycle: 'active' },
  })
  const item = (
    ((await itemsRes.json()).data ?? []) as {
      sku: string
      isSerialTracked: boolean
    }[]
  ).find((i) => i.isSerialTracked)
  if (!item) throw new Error('no serial-tracked active item found in the catalog')

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
  await addInput.fill(item.sku)
  // Match on the SKU specifically, not the item name — a name substring can
  // surface sibling products (e.g. "Refrigerator Deodorizer").
  const option = page.getByRole('button', { name: new RegExp(item.sku) }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
  return item.sku
}

type FreeSerial = {
  id: string
  serialNumber: string
  item?: { id: string; name?: string } | null
  currentWarehouse?: { id: string } | null
}

/** A unit in stock and not claimed by any open transfer — one the create
 * endpoint will accept as a pinned line. */
async function findFreeSerial(page: import('@playwright/test').Page): Promise<FreeSerial> {
  const res = await page.request.get('/api/inventory/serial-numbers', {
    params: { status: 'in_stock', freeForTransfer: 'true', limit: '50' },
  })
  const serial = (((await res.json()).data ?? []) as FreeSerial[]).find(
    (s) => s.item?.id && s.currentWarehouse?.id
  )
  if (!serial) throw new Error('no free in-stock serial found to transfer')
  return serial
}

test.describe('Inventory — Stock Transfer serial-tracked requesting', () => {
  test('a serial-tracked line picks exact serials — no quantity mode', async ({ page }) => {
    await openCreateModal(page)
    await pickWarehouses(page)
    await addSerialTrackedItem(page)

    // The picker shows straight away; there is no by-quantity alternative.
    await expect(page.getByTestId('serial-pick-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('radio', { name: 'By quantity' })).toHaveCount(0)

    // The unit count is the pick itself — read-only, starting at none.
    const qty = page.getByLabel('Units to send')
    await expect(qty).toHaveAttribute('readonly', '')
    await expect(qty).toHaveValue('0')

    // The option list only opens once the search box is in use.
    const panel = page.getByTestId('serial-pick-panel')
    await expect(panel.getByRole('checkbox')).toHaveCount(0)
    await panel.getByPlaceholder('Search serial number to add…').click()

    // Ticking a free unit, if the source has one, counts it.
    const firstSerial = page.getByTestId('serial-pick-panel').getByRole('checkbox').first()
    if (await firstSerial.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstSerial.click()
      await expect(qty).toHaveValue('1')
    }

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('submitting a serial-tracked line with nothing picked is refused', async ({ page }) => {
    await openCreateModal(page)
    await pickWarehouses(page)
    await addSerialTrackedItem(page)
    await expect(page.getByTestId('serial-pick-panel')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expect(page.getByText('Pick at least one serial')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('serials ticked in Item 360 arrive picked and ship pinned (then cancel)', async ({
    page,
  }) => {
    const uniqueReason = `E2E-TRF-SERIAL-${Date.now()}`
    await gotoReady(page, '/inventory/transfers')
    const serial = await findFreeSerial(page)

    // The same deep link Item 360's "Transfer selected" builds.
    const params = new URLSearchParams({
      prefillFromWarehouseId: serial.currentWarehouse!.id,
      prefillItemId: serial.item!.id,
      prefillItemLabel: serial.item?.name ?? 'Item',
      prefillQty: '1',
      prefillSerialIds: serial.id,
    })
    await gotoReady(page, `/inventory/transfers?${params.toString()}`)
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible({
      timeout: 10_000,
    })

    const panel = page.getByTestId('serial-pick-panel')
    await expect(panel.getByText(serial.serialNumber, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('1 line · 1 units')).toBeVisible()

    await pickComboboxOption(page, 'Search destination branch…')
    await page.getByPlaceholder('e.g. Rebalancing stock for upcoming campaign').fill(uniqueReason)

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Request' }).click()
      await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toHaveCount(0, {
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    // Open this run's transfer and confirm the line is pinned to that unit.
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
    await expect(page.getByText(serial.serialNumber).first()).toBeVisible()

    // Cleanup: cancel so repeated runs don't pile up test transfers.
    await page.getByRole('button', { name: 'Cancel Transfer' }).click()
    await page.getByRole('button', { name: 'Yes, Cancel Transfer' }).click()
    await expect(page.getByText('Cancel this transfer?')).toHaveCount(0, { timeout: 10_000 })
  })
})
