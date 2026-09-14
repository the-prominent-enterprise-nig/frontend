import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Clicking a serial chip under an expanded location (Stock tab) drills into
// that one physical unit's own movement timeline (receipt/transfer/sale/
// etc.), assembled server-side from the transaction-line tables that
// reference it — there's no per-serial StockLedger row to read. There is no
// standalone Serials tab: serials live inline under each location.
test.describe('Inventory — Item 360 drawer, per-serial movement drill-down', () => {
  test('clicking a serial shows its own timeline, with a way back to Stock', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search brand, model, or category…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    // The list is a CSS-grid table (role="table"/"row"), not a <table>,
    // matching Purchase Orders.
    const row = page.getByRole('row').filter({ hasText: 'Washing Machine' }).first()
    await expect(async () => {
      await fillStable(searchInput, 'Washing Machine')
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await row.click()

    const drawer = page.getByRole('dialog', { name: 'Item Details' })
    const drawerTabs = drawer.getByRole('navigation', { name: 'Item 360 tabs' })
    await expect(drawerTabs).toBeVisible({ timeout: 10_000 })
    // Stock is the default tab for this context, so its content — including
    // the location rows — is already showing.

    // Expanding a location row reveals its serial numbers as chips — seeded
    // with 200 in-stock serials per branch (prisma/seed.ts).
    const locationRow = drawer.getByTestId('stock-location-row').first()
    await expect(locationRow).toBeVisible({ timeout: 10_000 })
    await locationRow.click()
    await expect(drawer.getByText('Serial numbers at this location')).toBeVisible({
      timeout: 10_000,
    })

    const serialChip = drawer.getByTestId('serial-chip').first()
    await expect(serialChip).toBeVisible({ timeout: 10_000 })
    const serialNumberText = (await serialChip.innerText()).trim()
    await serialChip.click()

    // Drilled in: tab nav is replaced by a back button + this one serial's
    // own header and timeline.
    await expect(drawerTabs).toHaveCount(0)
    const backButton = drawer.getByRole('button', { name: 'Back to Stock' })
    await expect(backButton).toBeVisible({ timeout: 10_000 })
    await expect(drawer.getByText(serialNumberText, { exact: true })).toBeVisible()

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
