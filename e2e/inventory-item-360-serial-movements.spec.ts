import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Clicking a serial on the Serials tab drills into that one physical unit's
// own movement timeline (receipt/transfer/sale/etc.), assembled server-side
// from the transaction-line tables that reference it — there's no per-serial
// StockLedger row to read.
test.describe('Inventory — Item 360 drawer, per-serial movement drill-down', () => {
  test('clicking a serial shows its own timeline, with a way back to the list', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search item name, SKU, or serial number…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    const row = page.locator('tbody tr', { hasText: 'Washing Machine' }).first()
    await expect(async () => {
      await fillStable(searchInput, 'Washing Machine')
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await row.click()

    // The underlying Stock Balance table stays mounted behind the drawer
    // overlay, so an unscoped 'tbody tr' locator can resolve to either
    // table — scope everything to the drawer itself.
    const drawer = page.getByRole('dialog', { name: 'Item Details' })
    const drawerTabs = drawer.getByRole('navigation', { name: 'Item 360 tabs' })
    await expect(drawerTabs).toBeVisible({ timeout: 10_000 })
    await drawerTabs.getByRole('button', { name: 'Serials' }).click()

    const serialRow = drawer.locator('tbody tr').first()
    await expect(serialRow).toBeVisible({ timeout: 10_000 })
    const serialNumberText = await serialRow.locator('td').first().innerText()
    await serialRow.click()

    // Drilled in: tab nav is replaced by a back button + this one serial's
    // own header and timeline.
    await expect(drawerTabs).toHaveCount(0)
    const backButton = drawer.getByRole('button', { name: 'Back to Serials' })
    await expect(backButton).toBeVisible({ timeout: 10_000 })
    await expect(drawer.getByText(serialNumberText.trim(), { exact: true })).toBeVisible()

    // Seeded serials are bulk-registered directly (no goods-receipt or
    // transaction-line fixtures behind them), so the real, correct state
    // here is the empty one — this proves the drill-down renders it
    // properly rather than erroring or showing stale/wrong data. The
    // populated-timeline path (receipt/transfer/sale entries actually
    // appearing) is covered by backend code review, not live seed data here.
    await expect(drawer.getByText('No movements recorded yet')).toBeVisible({ timeout: 10_000 })

    await backButton.click()
    await expect(backButton).toHaveCount(0)
    await expect(drawerTabs).toBeVisible()
  })
})
