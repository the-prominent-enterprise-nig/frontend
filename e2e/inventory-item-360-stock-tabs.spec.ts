import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

test.describe('Inventory — Item 360 drawer, opened from Stock Balance', () => {
  test('clicking a row opens the drawer scoped to Stock, with Movements and quick actions, no Overview or standalone Serials tab', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const searchInput = page.getByPlaceholder('Search brand, model, or category…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    // A later hydration reconciliation on this page can silently wipe the
    // search value after fillStable's own check has already passed (the same
    // race fillAllStable's docstring describes for multi-field forms) —
    // retry the fill itself until the filtered row actually shows up, rather
    // than trusting a single fill to survive. The list is a CSS-grid table
    // (role="table"/"row"), not a <table>, matching Purchase Orders.
    const row = page.getByRole('row').filter({ hasText: 'Washing Machine' }).first()
    await expect(async () => {
      await fillStable(searchInput, 'Washing Machine')
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await row.click()

    // Stock tab is the default for this context and its content shows directly.
    await expect(page.getByRole('navigation', { name: 'Item 360 tabs' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'Stock', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Movements' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Overview' })).toHaveCount(0)
    // Serial numbers live inline under each location (expand a row) rather
    // than in their own tab, same as the old History tab, which was
    // consolidated into Movements.
    await expect(page.getByRole('button', { name: 'Serials' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0)

    // Operational quick actions belong here, unlike the Catalog-opened drawer.
    await expect(page.getByRole('link', { name: 'Receive Stock' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Transfer', exact: true })).toBeVisible()

    // Expanding a location row loads and reveals its serial numbers inline —
    // seeded with 200 in-stock serials per branch (prisma/seed.ts), so the
    // empty state must not show for a location carrying stock.
    const locationRow = page.getByTestId('stock-location-row').first()
    await expect(locationRow).toBeVisible({ timeout: 10_000 })
    await locationRow.click()
    await expect(page.getByText('Serial numbers at this location')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('No serial numbers registered for this location yet.')).toHaveCount(
      0
    )
  })

  // Client report: filtering Stock Balance to Negros then picking 2+ branches
  // (Binalbagan, Candoni) and opening an item still showed every branch's
  // movements once the drawer landed on that tab. get-item-stock-summary and
  // getSerialNumbers already threaded the drawer's `locations` scope through
  // (the Stock tab, covered above) — MovementsTab never received that prop at
  // all, so its Current Stock pills and ledger entries answered tenant-wide
  // regardless of the branch filter.
  //
  // Uses the "TV Console Furniture Set" demo item (prisma/seed.ts) rather
  // than a real Item Master catalog item: it's the one item deterministically
  // serial-tracked with stock at every branch (200 units/branch), so this
  // doesn't depend on which branches a real item's historical AR data happens
  // to have landed in.
  test('multi-branch filter scopes Movements to the selected branches, not every branch', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const picker = page.locator('input[placeholder="All Branches"]')
    await picker.click()
    const options = page.getByRole('checkbox')
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(1)
    await page.getByRole('checkbox', { name: 'Binalbagan', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Candoni', exact: true }).click()
    await page.locator('h1').click()

    const searchInput = page.getByPlaceholder('Search brand, model, or category…')
    const row = page.getByRole('row').filter({ hasText: 'TV Console Furniture Set' }).first()
    await expect(async () => {
      await fillStable(searchInput, 'TV Console Furniture Set')
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await row.click()

    const drawer = page.getByRole('dialog', { name: 'Item Details' })
    const drawerTabs = drawer.getByRole('navigation', { name: 'Item 360 tabs' })
    await expect(drawerTabs).toBeVisible({ timeout: 10_000 })

    // Stock tab (the default) is already covered by the test above — sanity
    // check it's scoped to exactly these 2 branches here too.
    await expect(drawer.getByTestId('stock-location-row')).toHaveCount(2, { timeout: 10_000 })

    await drawerTabs.getByRole('button', { name: 'Movements' }).click()

    const pills = drawer.getByTestId('movements-location-pill')
    await expect(pills).toHaveCount(2, { timeout: 10_000 })
    const pillLabels = (await pills.allTextContents()).join(' | ')
    expect(pillLabels).toContain('Binalbagan')
    expect(pillLabels).toContain('Candoni')
    // The tenant has dozens of other Negros/Panay branches — none may leak in.
    expect(pillLabels).not.toContain('Bago')
    expect(pillLabels).not.toContain('Canlaon')
  })
})
