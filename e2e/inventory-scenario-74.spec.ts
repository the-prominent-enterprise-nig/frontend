import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { gotoReady, clickStable, cancelStockTransfer } from './utils'

// Scenario 74 Part 4 — inventory (client notes, 2026-10-16):
//  - Stock Transfer: "1 of 1 assigned" was hard to see (zinc-400) → body colour.
//  - Stock Transfer: "Carrier not needed" → the dispatch form starts with
//    "NIG", still editable and still required (D6).
//  - General Stock Book: "Display the date only; remove the time" → the
//    Serial History entries show the date alone.
//  - Stock Balance: "Fix the filter so it displays the correct units" → a
//    parent category lists the items filed under its subcategories. The
//    in-transit half is covered by backend test/scenario-74-stock-balance.
// Case IDs (S74-4-F…) match docs/scenario-74-oct16-client-notes-quick-wins-plan.md.
//
// The transfer is created and accepted through the API and never dispatched,
// so no stock moves; it is cancelled in afterAll.

const PREFIX = 'E2E S74 Inv'
let transferId: string | null = null
const transferReason = `${PREFIX} transfer ${Date.now()}`

async function acceptedSerialTransfer(request: APIRequestContext): Promise<string> {
  const warehouses = ((
    await (await request.get('/api/inventory/warehouses?limit=200&status=active')).json()
  ).data ?? []) as { id: string; branchId: string | null }[]
  const branchWarehouses = warehouses.filter((w) => w.branchId)
  for (const from of branchWarehouses) {
    const serials = ((
      await (
        await request.get('/api/inventory/serial-numbers', {
          params: { warehouseId: from.id, status: 'in_stock', limit: '50' },
        })
      ).json()
    ).data ?? []) as { itemId: string }[]
    if (serials.length === 0) continue
    const to = branchWarehouses.find((w) => w.id !== from.id)!
    const res = await request.post('/api/inventory/transfers', {
      data: {
        fromWarehouseId: from.id,
        toWarehouseId: to.id,
        transferDate: new Date().toISOString().split('T')[0],
        reason: transferReason,
        lines: [{ itemId: serials[0].itemId, quantity: 1 }],
      },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    const t = await res.json()
    const accept = await request.patch(`/api/inventory/transfers/${t.id}/accept`, { data: {} })
    expect(accept.ok(), await accept.text()).toBeTruthy()
    return t.id
  }
  throw new Error('no branch warehouse with an in-stock serial')
}

async function openDispatchForm(page: Page) {
  await gotoReady(page, '/inventory/transfers')
  await expect(async () => {
    await page.locator('tbody tr').first().click()
    await expect(page.getByRole('heading', { name: 'Transfer Details' })).toBeVisible({
      timeout: 3_000,
    })
    const mine = await page
      .getByText(transferReason, { exact: true })
      .isVisible()
      .catch(() => false)
    if (!mine) {
      await page.getByRole('button', { name: 'Close dialog' }).click()
      throw new Error('opened transfer is not this spec’s — retrying')
    }
  }).toPass({ timeout: 20_000 })
  const modal = page.locator('.fixed.inset-0.z-50')
  await clickStable(
    modal.getByRole('button', { name: 'Dispatch' }),
    modal.getByRole('button', { name: 'Confirm Dispatch' }),
    { timeout: 15_000 }
  )
  return modal
}

test.describe('Scenario 74 Part 4 — inventory', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({
      baseURL,
      storageState: 'e2e/.auth/business-owner.json',
    })
    if (transferId) await cancelStockTransfer(request, transferId)
    await request.dispose()
  })

  test('S74-4-F01 — "N of N assigned" on the dispatch form is the body colour, not grey', async ({
    page,
  }) => {
    transferId = await acceptedSerialTransfer(page.request)
    const modal = await openDispatchForm(page)
    const count = modal.getByTestId('serial-assigned-count').first()
    await expect(count).toContainText(/of 1 assigned/)
    // #17171c — the file's body colour. zinc-400 was rgb(161, 161, 170).
    await expect(count).toHaveCSS('color', 'rgb(23, 23, 28)')
  })

  test('S74-4-F02 — the dispatch form opens with the carrier "NIG", and it can be changed', async ({
    page,
  }) => {
    const modal = await openDispatchForm(page)
    const carrier = modal.getByPlaceholder('e.g. LBC Express')
    await expect(carrier).toHaveValue('NIG')
    await carrier.fill('LBC')
    await expect(carrier).toHaveValue('LBC')
  })

  test('S74-4-F03 (edge) — clearing the carrier still stops the dispatch', async ({ page }) => {
    const modal = await openDispatchForm(page)
    await modal.getByPlaceholder('e.g. LBC Express').fill('')
    await modal.getByRole('button', { name: 'Confirm Dispatch' }).click()
    await expect(modal.getByText('Carrier name is required')).toBeVisible({ timeout: 10_000 })
    // Still not dispatched.
    await expect(modal.getByText('In Transit', { exact: true })).toHaveCount(0)
  })

  test('S74-4-F04 — Serial History entries show a date and no time', async ({ page }) => {
    // The Locator tab is the one with movement history; the Serial Numbers
    // (stock book) tab has none.
    await gotoReady(page, '/inventory/stock?tab=locator')
    const serialLink = page.getByTestId('serial-link').first()
    await expect(serialLink).toBeVisible({ timeout: 15_000 })
    await serialLink.click()
    const history = page.getByRole('dialog', { name: 'Serial History' })
    const dates = history.getByTestId('serial-history-date')
    await expect(dates.first()).toBeVisible({ timeout: 10_000 })
    for (const text of await dates.allTextContents()) {
      expect(text.trim()).toMatch(/^[A-Z][a-z]{2,4} \d{1,2}, \d{4}$/)
      expect(text).not.toMatch(/AM|PM|\d:\d\d/)
    }
  })

  test('S74-4-F05 — Stock Balance: picking a parent category lists the item filed under its subcategory', async ({
    page,
  }) => {
    // One fixed category pair and item, found or created, so reruns don't
    // leave a new stocked item in the dev Stock Balance each time (an item
    // with stock can't be deleted).
    const request = page.request
    const parentName = `${PREFIX} Parent`
    const childName = `${PREFIX} Child`
    const itemName = `${PREFIX} Item`
    const sku = 'E2E-S74INV-ITEM'

    const categories = ((await (await request.get('/api/inventory/categories?limit=500')).json())
      .data ?? []) as { id: string; name: string; parentCategoryId: string | null }[]
    const ensureCategory = async (name: string, parentCategoryId?: string) => {
      const found = categories.find((c) => c.name === name)
      if (found) return found.id
      const res = await request.post('/api/inventory/categories', {
        data: {
          name,
          ...(parentCategoryId && { parentCategoryId }),
          displayOrder: 0,
          status: 'active',
          allowsCustomAttributes: false,
        },
      })
      expect(res.ok(), await res.text()).toBeTruthy()
      return (await res.json()).id as string
    }
    const parentId = await ensureCategory(parentName)
    const childId = await ensureCategory(childName, parentId)

    const existing = ((
      await (
        await request.get(`/api/inventory/items?search=${encodeURIComponent(sku)}&limit=5`)
      ).json()
    ).data ?? []) as { id: string; sku: string }[]
    let itemId = existing.find((i) => i.sku === sku)?.id
    if (!itemId) {
      const baseUnitId = ((await (await request.get('/api/inventory/items?limit=1')).json()).data ??
        [])[0].baseUnit.id as string
      const itemRes = await request.post('/api/inventory/items', {
        data: {
          sku,
          name: itemName,
          baseUnitId,
          isSerialTracked: false,
          sellingPrice: 1000,
          primaryCategoryId: childId,
        },
      })
      expect(itemRes.ok(), await itemRes.text()).toBeTruthy()
      itemId = (await itemRes.json()).id as string
      await request.post(`/api/inventory/items/${itemId}/submit`)
      await request.post(`/api/inventory/items/${itemId}/confirm-accounting`, { data: {} })
      await request.post(`/api/inventory/items/${itemId}/approve`, { data: {} })

      const warehouses = ((
        await (await request.get('/api/inventory/warehouses?limit=200&status=active')).json()
      ).data ?? []) as { id: string; branchId: string | null }[]
      const adj = await request.post('/api/inventory/adjustments', {
        data: {
          warehouseId: warehouses.find((w) => w.branchId)!.id,
          adjustmentDate: new Date().toISOString().slice(0, 10),
          reasonCode: 'found',
          notes: 'E2E Scenario 74 category fixture',
          lines: [{ itemId, expectedQty: 0, actualQty: 3 }],
        },
      })
      expect(adj.ok(), await adj.text()).toBeTruthy()
      const adjustment = await adj.json()
      for (const step of ['confirm', 'investigate', 'approve']) {
        const r = await request.patch(`/api/inventory/adjustments/${adjustment.id}/${step}`)
        expect(r.ok(), await r.text()).toBeTruthy()
      }
    }

    await gotoReady(page, '/inventory/stock')
    const picker = page.getByPlaceholder('All Categories')
    await expect(picker).toBeVisible({ timeout: 20_000 })
    await picker.click()
    await picker.fill(parentName)
    await page.getByRole('button', { name: parentName, exact: true }).click()
    await expect(page.getByText(itemName, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })
  })
})
