import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 34 Part 2 — the Price Lists table now renders an item count next
// to each row's status badge (e.g. "3 items priced") instead of reading as a
// bare label, so an admin can tell at a glance which lists are actually
// pricing containers vs. empty shells.
test.describe('Inventory — Price Lists — item count', () => {
  test('shows 0 items priced for an empty list, and updates after adding one', async ({
    page,
    request,
  }) => {
    const typeName = `E2E Item Count Type ${Date.now()}`
    const typeRes = await request.post('/api/inventory/price-use-types', {
      data: { name: typeName },
    })
    expect(typeRes.ok()).toBeTruthy()
    const typeId = (await typeRes.json()).id as string

    const listName = `E2E Item Count List ${Date.now()}`
    const listRes = await request.post('/api/inventory/price-lists', {
      data: { name: listName, priceUseTypeId: typeId },
    })
    expect(listRes.ok()).toBeTruthy()
    const listId = (await listRes.json()).id as string

    await gotoReady(page, '/inventory/price-lists')
    const row = page.getByRole('row').filter({ hasText: listName })
    await expect(row).toContainText('0 items priced')

    // Same fixture item other price-list specs use (e.g.
    // inventory-price-list-installment-terms.spec.ts) — a simple, non-variant
    // item so the upsert doesn't also need a variantId.
    const itemsRes = await request.get('/api/inventory/items', {
      params: { search: 'Universal Remote Control', limit: '1' },
    })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
    const item = items[0]
    expect(item).toBeTruthy()

    const upsertRes = await request.post(`/api/inventory/price-lists/${listId}/items`, {
      data: { items: [{ itemId: item.id, price: 10 }] },
    })
    expect(upsertRes.ok()).toBeTruthy()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(row).toContainText('1 item priced', { timeout: 10_000 })

    // Cleanup: the list has to go before its price use type can be deleted.
    await request.delete(`/api/inventory/price-lists/${listId}`)
    await request.delete(`/api/inventory/price-use-types/${typeId}`)
  })
})
