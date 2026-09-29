import { test, expect, type Page } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  pickComboboxOption,
  findStockTransferIdByReason,
  cancelStockTransfer,
  sweepE2EStockTransfers,
} from './utils'

// Scenario 60 Part 2b — sending stock to a caravan is an ordinary Stock
// Transfer now. The destination is a Branch or a Caravan (an existing,
// ongoing one or a new one created inline with a required Host Branch, event
// name and dates). The old "This is a consignment" mode, and its
// venue-or-branch toggle, are gone.

const REASON_PREFIX = 'E2E-S60 caravan'

async function openCreateModal(page: Page): Promise<void> {
  await gotoReady(page, '/inventory/transfers')
  await clickStable(
    page.getByRole('button', { name: 'New Transfer' }),
    page.getByRole('heading', { name: 'New Stock Transfer' })
  )
}

async function addSerialTrackedItem(page: Page): Promise<void> {
  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { limit: '100', lifecycle: 'active' },
  })
  const item = (
    ((await itemsRes.json()).data ?? []) as { sku: string; isSerialTracked: boolean }[]
  ).find((i) => i.isSerialTracked)
  if (!item) throw new Error('no serial-tracked active item found in the catalog')

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
}

async function chooseCaravanDestination(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByRole('radio', { name: 'Caravan' }).click()
    await expect(page.getByPlaceholder('Search ongoing caravans…')).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

test.describe('Inventory — Caravan as a Stock Transfer destination', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EStockTransfers(request, REASON_PREFIX)
  })

  test('the consignment mode and its venue toggle are gone; Caravan is a destination type', async ({
    page,
  }) => {
    await openCreateModal(page)

    await expect(page.getByText('This is a consignment')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'A place' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Another branch' })).toHaveCount(0)

    await chooseCaravanDestination(page)
    await page.getByRole('button', { name: 'New caravan' }).click()

    const fields = page.getByTestId('new-caravan-fields')
    await expect(fields).toBeVisible()
    await expect(fields.getByText('Host branch')).toBeVisible()
    await expect(fields.getByText('Event name')).toBeVisible()
    // Optional, and deliberately not labelled as such.
    await expect(fields.getByText('Location', { exact: true })).toBeVisible()
    await expect(fields.getByText('Start date')).toBeVisible()
    await expect(fields.getByText('End date')).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('a new caravan needs its host branch, event name and dates before anything is saved', async ({
    page,
  }) => {
    await openCreateModal(page)
    await chooseCaravanDestination(page)
    await page.getByRole('button', { name: 'New caravan' }).click()
    await page.getByRole('button', { name: 'Submit Request' }).click()

    await expect(page.getByText('New caravan: choose its host branch.')).toBeVisible()
    await expect(page.getByText('New caravan: give the event a name.')).toBeVisible()
    await expect(page.getByText('New caravan: check the event dates.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('creates a caravan inline and sends stock to it, labelled with its event, location and host', async ({
    page,
  }) => {
    const stamp = Date.now()
    const eventName = `E2E Caravan Fair ${stamp}`
    const reason = `${REASON_PREFIX} ${stamp}`
    const today = new Date().toISOString().slice(0, 10)

    await openCreateModal(page)
    await pickComboboxOption(page, 'Search source branch…')
    await addSerialTrackedItem(page)

    await chooseCaravanDestination(page)
    await page.getByRole('button', { name: 'New caravan' }).click()
    const fields = page.getByTestId('new-caravan-fields')
    const host = await pickComboboxOption(page, 'Search host branch…')
    await fillStable(fields.getByPlaceholder(/Fiesta Appliance Fair/), eventName)
    await fillStable(fields.getByPlaceholder(/SM City Bacolod/), 'E2E Town Plaza')
    // Ends today, so the caravan drops out of the branch lists by tomorrow.
    await fillStable(fields.locator('input[type="date"]').nth(1), today)
    await fillStable(page.getByPlaceholder(/Rebalancing stock/), reason)

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Request' }).click()
      await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toHaveCount(0, {
        timeout: 5_000,
      })
    }).toPass({ timeout: 30_000 })

    const label = `Caravan · ${eventName} — E2E Town Plaza (hosted by ${host})`
    await expect(page.locator('tbody tr', { hasText: eventName }).first()).toContainText(label, {
      timeout: 15_000,
    })

    // Cleanup: cancel the request and retire the caravan.
    const transferId = await findStockTransferIdByReason(page.request, reason)
    await cancelStockTransfer(page.request, transferId)
    const caravansRes = await page.request.get('/api/inventory/caravans')
    const caravan = ((await caravansRes.json()).data as { id: string; eventName: string }[]).find(
      (c) => c.eventName === eventName
    )
    if (caravan) await page.request.patch(`/api/branches/${caravan.id}/deactivate`)
  })
})
