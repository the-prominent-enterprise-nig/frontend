import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Clicking a serial chip under an expanded location (Stock tab) opens that one
// physical unit's Serial History panel on top of the item — the same panel
// every other screen opens — assembled server-side from the transaction-line
// tables that reference it. Back returns to the item.
test.describe('Inventory — Item 360 drawer, per-serial movement drill-down', () => {
  test('clicking a serial opens its history panel, with a way back to the item', async ({
    page,
  }) => {
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

    const history = page.getByRole('dialog', { name: 'Serial History' })
    await expect(history).toBeVisible({ timeout: 10_000 })
    await expect(history.getByText(serialNumberText, { exact: true })).toBeVisible()

    // Seeded serials are bulk-registered directly (no goods receipt behind
    // them), so their timeline starts with the "Added to inventory" entry
    // rather than being blank.
    await expect(history.getByText('Added to inventory')).toBeVisible({ timeout: 10_000 })

    const backButton = history.getByRole('button', { name: 'Back', exact: true })
    await backButton.click()
    await expect(page.getByRole('dialog', { name: 'Item Details' })).toBeVisible()
    await expect(drawerTabs).toBeVisible()
  })
})
