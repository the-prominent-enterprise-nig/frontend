import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// History was consolidated into Movements: a field-edit entry from the
// item's change log now merges into the same timeline as stock-ledger
// entries, distinguished by its own "Edited" badge — instead of a separate
// History tab. This creates a real edit via the API (mirrors
// inventory-stock-adjustment-approval-chain.spec.ts's "fixture via API,
// exercise UI" split) so the merge has something real to show.
test.describe('Inventory — Item 360 drawer, Movements/History consolidation', () => {
  test('a field edit shows up in Movements as its own entry, not a separate tab', async ({
    page,
  }) => {
    const itemsRes = await page.request.get('/api/inventory/items?search=Washing Machine&limit=1')
    const items = ((await itemsRes.json()).data ?? []) as { id: string; lifecycle: string }[]
    expect(items.length).toBeGreaterThan(0)
    const item = items[0]
    const newLifecycle = item.lifecycle === 'discontinued' ? 'active' : 'discontinued'

    const patchRes = await page.request.patch(`/api/inventory/items/${item.id}/lifecycle`, {
      data: { lifecycle: newLifecycle },
    })
    expect(patchRes.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search item name, SKU, or serial number…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    const row = page.locator('tbody tr', { hasText: 'Washing Machine' }).first()
    await expect(async () => {
      await fillStable(searchInput, 'Washing Machine')
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await row.click()

    const drawer = page.getByRole('dialog', { name: 'Item Details' })
    const drawerTabs = drawer.getByRole('navigation', { name: 'Item 360 tabs' })
    await expect(drawerTabs).toBeVisible({ timeout: 10_000 })

    // No separate History tab anymore.
    await expect(drawerTabs.getByRole('button', { name: 'History' })).toHaveCount(0)

    await drawerTabs.getByRole('button', { name: 'Movements' }).click()
    await expect(drawer.getByText('Edited', { exact: true })).toBeVisible({ timeout: 10_000 })
    // "discontinued"/"active" also appear in the header's own lifecycle
    // badge, so match the diff line's own combined text specifically rather
    // than the bare value anywhere in the drawer.
    await expect(drawer.getByText(new RegExp(`Lifecycle:.*${newLifecycle}`))).toBeVisible()
  })
})
