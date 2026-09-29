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

// Scenario 60 Part 2 — sending stock to a caravan is an ordinary Stock
// Transfer now. Switching on "For a caravan" creates the caravan from the
// details entered (required Host Branch, event name and dates; optional
// location). Stock already at a caravan moves on by picking the caravan as
// the source. The old consignment mode and its venue-or-branch toggle are gone.

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

async function turnOnForACaravan(page: Page): Promise<void> {
  await expect(async () => {
    // The switch's input is visually hidden; its label is what people click.
    if (!(await page.getByRole('switch', { name: /For a caravan/ }).isChecked())) {
      await page.getByText('For a caravan', { exact: true }).click()
    }
    await expect(page.getByTestId('new-caravan-fields')).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

test.describe('Inventory — Caravan as a Stock Transfer destination', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EStockTransfers(request, REASON_PREFIX)
  })

  test('the old venue toggle is gone; "For a caravan" opens the new-caravan form, with no existing-caravan picker', async ({
    page,
  }) => {
    await openCreateModal(page)

    await expect(page.getByText('This is a consignment')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'A place' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Another branch' })).toHaveCount(0)

    await turnOnForACaravan(page)

    const fields = page.getByTestId('new-caravan-fields')
    await expect(fields).toBeVisible()
    await expect(fields.getByText('Host branch')).toBeVisible()
    await expect(fields.getByText('Event name')).toBeVisible()
    // Optional, and deliberately not labelled as such.
    await expect(fields.getByText('Location', { exact: true })).toBeVisible()
    await expect(fields.getByText('Start date')).toBeVisible()
    await expect(fields.getByText('End date')).toBeVisible()

    // Only ever a new caravan — no picker of existing ones.
    // "To" is hidden entirely — the caravan's details are the destination.
    await expect(page.getByText('To', { exact: true })).toHaveCount(0)
    await expect(page.getByPlaceholder('Select a caravan…')).toHaveCount(0)

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('a new caravan needs its host branch, event name and dates before anything is saved', async ({
    page,
  }) => {
    await openCreateModal(page)
    await turnOnForACaravan(page)
    await page.getByRole('button', { name: 'Submit Request' }).click()

    // Each field says what it needs, right where it is — no summary panel.
    const fields = page.getByTestId('new-caravan-fields')
    await expect(fields.getByText('Enter the event name')).toBeVisible()
    await expect(fields.getByText('Enter the end date')).toBeVisible()
    await expect(page.getByText(/to resolve before this can be submitted/)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
  })

  test('creates a caravan inline and sends stock to it, labelled with its event name alone', async ({
    page,
  }) => {
    const stamp = Date.now()
    const eventName = `E2E Caravan Fair ${stamp}`
    const reason = `${REASON_PREFIX} ${stamp}`
    const today = new Date().toISOString().slice(0, 10)

    await openCreateModal(page)
    await pickComboboxOption(page, 'Search source branch…')
    await addSerialTrackedItem(page)

    await turnOnForACaravan(page)
    const fields = page.getByTestId('new-caravan-fields')
    await pickComboboxOption(page, 'Search host branch…')
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

    // The event is named "…Caravan…", so the label is the name alone — no
    // "Caravan ·" prefix, location or host.
    const row = page.locator('tbody tr', { hasText: eventName }).first()
    await expect(row).toContainText(eventName, { timeout: 15_000 })
    await expect(row).not.toContainText('hosted by')

    // Cleanup: cancel the request and retire the caravan.
    const transferId = await findStockTransferIdByReason(page.request, reason)
    await cancelStockTransfer(page.request, transferId)
    const caravansRes = await page.request.get('/api/inventory/caravans')
    const caravan = ((await caravansRes.json()).data as { id: string; eventName: string }[]).find(
      (c) => c.eventName === eventName
    )
    if (caravan) await page.request.patch(`/api/branches/${caravan.id}/deactivate`)
  })

  test('Serial Numbers: no consign action; the Caravan tab lists a received unit with its caravan, host and Transfer out', async ({
    page,
  }) => {
    const api = page.request
    const stamp = Date.now()
    const eventName = `E2E Caravan Tab ${stamp}`
    const today = new Date().toISOString().slice(0, 10)

    // A unit that actually sits in a caravan: create the caravan, then walk
    // one serial through the ordinary transfer lifecycle into it.
    const warehouses = (
      await (await api.get('/api/inventory/warehouses?limit=200&status=active')).json()
    ).data as { id: string; branchId: string | null; branch?: { isTemporary?: boolean } | null }[]
    const serials = (
      await (await api.get('/api/inventory/serial-numbers?status=in_stock&limit=200')).json()
    ).data as {
      id: string
      serialNumber: string
      item: { id: string }
      currentWarehouse: { id: string; branchId: string | null } | null
      openTransfer: unknown
    }[]
    const unit = serials.find(
      (s) =>
        !s.openTransfer &&
        s.currentWarehouse?.branchId &&
        !warehouses.find((w) => w.id === s.currentWarehouse?.id)?.branch?.isTemporary
    )
    if (!unit?.currentWarehouse?.branchId) throw new Error('no free in-stock serial at a branch')
    const host = unit.currentWarehouse

    const caravan = await (
      await api.post('/api/inventory/caravans', {
        data: {
          hostBranchId: host.branchId,
          eventName,
          location: 'E2E Town Plaza',
          startDate: today,
          endDate: today,
        },
      })
    ).json()
    const created = await (
      await api.post('/api/inventory/transfers', {
        data: {
          fromWarehouseId: host.id,
          toWarehouseId: caravan.warehouseId,
          transferDate: today,
          skipDestinationApproval: true,
          reason: `${REASON_PREFIX} tab ${stamp}`,
          lines: [{ itemId: unit.item.id, quantity: 1 }],
        },
      })
    ).json()
    if (created.status === 'pending_hq_approval') {
      await api.patch(`/api/inventory/transfers/${created.id}/approve-hq`, { data: {} })
    }
    await api.patch(`/api/inventory/transfers/${created.id}/accept`, { data: {} })
    await api.patch(`/api/inventory/transfers/${created.id}/dispatch`, {
      data: {
        driverName: 'E2E Driver',
        driverPhone: '09170000000',
        vehiclePlate: 'E2E 600',
        carrierName: 'E2E Carrier',
        serialAssignments: [{ lineId: created.lines[0].id, serialNumberId: unit.id }],
      },
    })
    const received = await api.patch(`/api/inventory/transfers/${created.id}/receive`, {
      data: {
        receivedDate: today,
        lines: [{ stockTransferLineId: created.lines[0].id, quantityReceived: 1 }],
      },
    })
    expect(received.ok()).toBe(true)

    // All Serials: the old bulk consign action and its row checkboxes are gone.
    await gotoReady(page, '/inventory/serial-numbers')
    await expect(page.getByRole('checkbox', { name: 'Select all' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Consign for Caravan' })).toHaveCount(0)

    // Caravan tab, narrowed to this caravan.
    await clickStable(
      page.getByRole('button', { name: 'Caravan', exact: true }),
      page.getByPlaceholder('All caravans')
    )
    const caravanPicker = page.getByPlaceholder('All caravans')
    await caravanPicker.click()
    await caravanPicker.fill(eventName)
    await page.getByTestId('searchable-select-option').first().click()

    const row = page.locator('tbody tr', { hasText: unit.serialNumber })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText(eventName)
    await expect(row).toContainText('E2E Town Plaza')

    // Transfer out opens New Stock Transfer with the caravan as the source.
    await row.getByRole('link', { name: 'Transfer out' }).click()
    await expect(page.getByRole('heading', { name: 'New Stock Transfer' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(`Caravan · ${eventName}`).first()).toBeVisible()
    await page.getByRole('button', { name: 'Close dialog' }).click()

    // Cleanup: retire the caravan. The unit stays in its warehouse — a
    // received transfer is a real movement and has no undo; the e2e DB is
    // reset on each cold start.
    await api.patch(`/api/branches/${caravan.id}/deactivate`)
  })
})
