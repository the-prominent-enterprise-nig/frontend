import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  pickComboboxOption,
  createSellableItem,
  deleteItem,
  cancelStockTransfer,
} from './utils'

// "So I don't have to scroll down every time I add something": on the inventory
// forms the add control sits below the lines and stays on screen after each add,
// and new lines still go to the end of the list.
//
// Nothing is submitted. The one record made (an in-transit transfer, for the
// receiving form) is made through the API.

// Short on purpose, so a handful of lines overflows the screen.
test.use({ viewport: { width: 1280, height: 600 } })

const ADDS = 8

/** On screen in full, and not hidden behind a sticky footer. Does not scroll. */
async function expectReachable(control: Locator): Promise<void> {
  await expect(control).toBeInViewport({ ratio: 1 })
  await expect
    .poll(() =>
      control.evaluate((el) => {
        const box = el.getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return el.contains(hit)
      })
    )
    .toBe(true)
}

/** The newest line's own remove button; hidden layouts don't count. */
function lastRemove(page: Page): Locator {
  return page.getByRole('button', { name: 'Remove line' }).locator('visible=true').last()
}

/** The control sits under the newest line. */
async function expectBelow(control: Locator, lastLine: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const [c, l] = await Promise.all([control.boundingBox(), lastLine.boundingBox()])
      return !!c && !!l && c.y > l.y
    })
    .toBe(true)
}

/** Opens an item search and takes its first result. Retried as a unit: a click
 * that lands before hydration opens nothing. */
async function pickFirstItem(page: Page, search: Locator): Promise<void> {
  const first = page.getByTestId('search-combobox-option').first()
  await expect(async () => {
    if (!(await first.isVisible())) await search.click()
    await first.click({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
}

test.describe('Add-line control stays in view', () => {
  test('Stock Request: the item search follows the list', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=stock-request')
    const search = page.getByRole('button', { name: /Add item — search name or SKU/ })
    const removes = page.getByText(/^\d+ lines? · \d+ units$/)
    await expect(search).toBeVisible({ timeout: 20_000 })

    for (let n = 1; n <= ADDS; n++) {
      await pickFirstItem(page, search)
      await expect(removes).toContainText(`${n} line`)
      await expectReachable(search)
    }
    await expectBelow(search, page.getByLabel('Units to send').last())
  })

  test('Purchase Order: the item search follows the list', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=purchase-orders')
    const search = page.getByRole('button', {
      name: 'Search item by name or SKU to add a line…',
    })
    await clickStable(page.getByRole('button', { name: /New Purchase/ }).first(), search, {
      timeout: 30_000,
    })

    for (let n = 1; n <= ADDS; n++) {
      await pickFirstItem(page, search)
      await expect(page.getByText(`${n} ${n === 1 ? 'line' : 'lines'}`).first()).toBeVisible()
      await expectReachable(search)
    }
    await expectBelow(search, lastRemove(page))
  })

  test('Receiving Report: Add Line follows the list', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=receiving')
    const add = page.getByRole('button', { name: 'Add Line', exact: true })
    await clickStable(page.getByRole('button', { name: 'New Receipt' }), add, { timeout: 30_000 })

    // The form opens with one blank line already on it.
    for (let n = 2; n <= ADDS + 1; n++) {
      await add.click()
      await expect(page.getByText(new RegExp(`^${n} lines · `))).toBeVisible()
      await expectReachable(add)
    }
    await expectBelow(add, lastRemove(page))
  })

  test('Delivery Receipt: Add item stays in view', async ({ page }) => {
    await gotoReady(page, '/inventory/delivery-receipts/new')
    await pickComboboxOption(page, 'Select branch…')
    const add = page.getByRole('button', { name: 'Add item' })
    const quantities = page.getByLabel('Quantity')

    for (let n = 1; n <= ADDS; n++) {
      await add.click()
      await expect(quantities).toHaveCount(n)
      await expectReachable(add)
    }
    await expectBelow(add, quantities.last())
  })

  test('Unit Document Sheet: Add Unit follows the list', async ({ page }) => {
    await gotoReady(page, '/inventory/uds')
    await clickStable(
      page.getByRole('button', { name: 'Issue UDS' }),
      page.getByRole('heading', { name: 'Issue Unit Document Sheet' }),
      { timeout: 30_000 }
    )
    const add = page.getByRole('button', { name: 'Add Unit' })
    const reasons = page.getByPlaceholder('Issue reason (optional)')
    await expect(add).toBeVisible()
    const start = await reasons.count()

    for (let n = 1; n <= ADDS; n++) {
      await add.click()
      await expect(reasons).toHaveCount(start + n)
      await expectReachable(add)
    }
    await expectBelow(add, reasons.last())
  })

  test('Transfer receiving: Add unlisted item follows the list', async ({ page }) => {
    const api = page.request
    const list = async (url: string): Promise<Record<string, unknown>[]> =>
      (await (await api.get(url)).json()).data ?? []
    const warehouses = (await list('/api/inventory/warehouses?limit=200&status=active')) as {
      id: string
      branchId: string | null
    }[]
    const branches = (await list('/api/branches?limit=200')) as { id: string; name: string }[]
    const [from, to] = warehouses.filter((w) => branches.some((b) => b.id === w.branchId))
    // Its own stocked item: the seeded catalog has no free bulk stock to count on.
    const item = await createSellableItem(api, {
      prefix: 'E2E-ADD-LINE',
      branchName: branches.find((b) => b.id === from.branchId)!.name,
      sellingPrice: 100,
    })

    const created = await api.post('/api/inventory/transfers', {
      data: {
        fromWarehouseId: from.id,
        toWarehouseId: to.id,
        transferDate: new Date().toISOString().slice(0, 10),
        reason: `E2E-ADD-LINE-${Date.now()}`,
        lines: [{ itemId: item.id, quantity: 1 }],
      },
    })
    expect(created.ok(), await created.text()).toBe(true)
    const transfer = (await created.json()) as { id: string; transferNumber: string }

    try {
      // Needed only when the head-office review setting is on; refused otherwise.
      await api.patch(`/api/inventory/transfers/${transfer.id}/approve-hq`, { data: {} })
      const steps = [
        ['accept', {}],
        ['dispatch', { driverName: 'E2E Driver', vehiclePlate: 'E2E-0001' }],
      ] as const
      for (const [step, data] of steps) {
        const res = await api.patch(`/api/inventory/transfers/${transfer.id}/${step}`, { data })
        expect(res.ok(), `${step}: ${await res.text()}`).toBe(true)
      }

      await gotoReady(page, '/inventory/stock-transaction?tab=transfers')
      await page
        .getByPlaceholder('Search transfer #, item, SKU, or serial…')
        .fill(transfer.transferNumber)
      const add = page.getByRole('button', { name: '+ Add unlisted item' })
      const row = page.getByRole('row').filter({ hasText: transfer.transferNumber })
      // Opens the transfer, then its receive form. The click is aimed at the left of
      // the footer button: the dev tools badge sits over its right side.
      const drawerPrint = page.getByRole('button', { name: 'Print', exact: true })
      await clickStable(row.getByRole('button', { name: 'Receive' }), drawerPrint, {
        timeout: 30_000,
      })
      await page
        .getByRole('button', { name: 'Receive' })
        .last()
        .click({ position: { x: 12, y: 12 } })
      await expect(add).toBeVisible({ timeout: 15_000 })
      const removes = page.getByRole('button', { name: 'Remove unlisted item' })

      for (let n = 1; n <= ADDS; n++) {
        await add.click()
        await expect(removes).toHaveCount(n)
        await expectReachable(add)
      }
      await expectBelow(add, removes.last())
    } finally {
      // Refused once dispatched; the test database is reset on the next start.
      await cancelStockTransfer(api, transfer.id).catch(() => undefined)
      await deleteItem(api, item.id)
    }
  })
})
