import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, fillStable, pickComboboxOption } from './utils'

// Scenario 08 (Caravan) — sending stock out on a caravan starts from the
// Stock Transfer screen, but it is NOT a transfer: ownership never moves, so
// there is no destination branch, no dispatch and no receipt. Ticking "This
// is a consignment" swaps the form over to the consign endpoint, which marks
// the specific units picked here (a transfer, by contrast, leaves the choice
// of physical units to the source at dispatch).

async function openCreateModal(page: import('@playwright/test').Page) {
  await gotoReady(page, '/inventory/transfers')
  await clickStable(
    page.getByRole('button', { name: 'New Transfer' }),
    page.getByRole('heading', { name: 'New Stock Transfer' })
  )
}

async function addSerialTrackedItem(page: import('@playwright/test').Page) {
  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { limit: '100', lifecycle: 'active' },
  })
  const item = (
    ((await itemsRes.json()).data ?? []) as { sku: string; isSerialTracked: boolean }[]
  ).find((i) => i.isSerialTracked)
  if (!item) throw new Error('no serial-tracked active item found in the catalog')

  // SearchCombobox renders a BUTTON when closed and only swaps in the search
  // <input> once opened, so open it first, then type.
  await page
    .getByRole('button', { name: /Add item/ })
    .first()
    .click()
  const addInput = page.locator('input[placeholder*="Add item"]')
  await expect(addInput).toBeVisible({ timeout: 10_000 })
  await addInput.fill(item.sku)
  const option = page.getByRole('button', { name: new RegExp(item.sku) }).first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  await option.click()
  return item.sku
}

test.describe('Inventory — Consignment from the Stock Transfer screen', () => {
  test('ticking consignment drops the transfer-only fields and asks for the event instead', async ({
    page,
  }) => {
    await openCreateModal(page)
    await page.getByLabel('This is a consignment').check()

    await expect(page.getByRole('heading', { name: 'Send Stock Out on Caravan' })).toBeVisible()
    // Nothing is dispatched and nothing arrives, so neither date applies.
    await expect(page.getByText('Expected arrival')).toBeHidden()
    await expect(page.getByText('Caravan event')).toBeVisible()
    await expect(page.getByRole('button', { name: /Consign 0 Units/ })).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('consigning picked units to a venue records them against the host branch', async ({
    page,
  }) => {
    const venueName = `E2E Lemery Fair ${Date.now()}`

    await openCreateModal(page)
    await page.getByLabel('This is a consignment').check()

    // Source first — the picker below only lists units actually held there.
    await pickComboboxOption(page, 'Search source branch…')
    await addSerialTrackedItem(page)

    await page.getByRole('button', { name: 'A place' }).click()
    await fillStable(page.getByPlaceholder('e.g. Lemery Town Fair'), venueName)
    await fillStable(page.getByPlaceholder(/Iloilo Appliance Fair/), 'E2E Caravan Event')

    const panel = page.getByTestId('consign-pick-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    const cards = page.getByTestId('consign-pick-card')
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    const serialText = (await cards.first().innerText()).trim()
    await cards.first().click()
    await expect(cards.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /Consign 1 Unit/ })).toBeVisible()

    await expect(async () => {
      await page.getByRole('button', { name: /Consign 1 Unit/ }).click()
      await expect(page.getByRole('heading', { name: 'Send Stock Out on Caravan' })).toHaveCount(
        0,
        { timeout: 3_000 }
      )
    }).toPass({ timeout: 20_000 })

    // It lands on the Caravan tab of the branch that still owns it — a venue
    // consignment has no host branch to be found by.
    await gotoReady(page, '/inventory/serial-numbers')
    await page.getByRole('button', { name: 'Caravan' }).click()
    const branchPicker = page.getByPlaceholder('Select a branch…')
    if (await branchPicker.isVisible().catch(() => false)) {
      await branchPicker.click()
      await page.getByRole('option').first().click()
    }

    const row = page.locator('tbody tr', { hasText: serialText })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText(venueName)

    // Cleanup: end the consignment so repeat runs start from a clean unit.
    const serialsRes = await page.request.get(
      `/api/inventory/serial-numbers?search=${encodeURIComponent(serialText)}&limit=1`
    )
    const found = (await serialsRes.json()).data as { id: string }[]
    if (found.length > 0) {
      await page.request.post('/api/inventory/serial-numbers/close-consignment', {
        data: { serialNumberIds: [found[0].id] },
      })
    }
  })

  test('blocks the consign button until a destination, an event and a unit are given', async ({
    page,
  }) => {
    await openCreateModal(page)
    await page.getByLabel('This is a consignment').check()
    await page.getByRole('button', { name: /Consign 0 Units/ }).click()

    await expect(page.getByText('Pick the branch these units are leaving.')).toBeVisible()
    await expect(page.getByText('Name the caravan event.')).toBeVisible()
    await expect(page.getByText('Tick at least one unit to send out.')).toBeVisible()
    // Nothing was created — the panel is still open.
    await expect(page.getByRole('heading', { name: 'Send Stock Out on Caravan' })).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })
})
