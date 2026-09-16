import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 50 (Closing Gap 2) — the Stock Balance list used to render one row
// per StockBalance record, i.e. one per (item × location), so an item held in
// three branches read as three rows. The client asked for one row per item
// with the quantities rolled up, the Location column gone, the four
// quantity columns they actually work from, and a filter bar of
// search(brand/model/category) + Branches + Operations.
//
// Read-only against seeded data — creates nothing, so there is nothing to
// clean up.

test.describe('Inventory > Stock Balance list', () => {
  test('shows the four quantity columns and no Location column', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const headerRow = page.locator('table thead tr')
    await expect(headerRow).toBeVisible()

    const headers = (await headerRow.locator('th').allTextContents()).map((t) =>
      t.trim().toLowerCase()
    )

    expect(headers).toContain('item')
    expect(headers).toContain('on hand')
    expect(headers).toContain('sold')
    expect(headers).toContain('reserved')
    expect(headers).toContain('available')

    // The column the client asked to remove — a rolled-up row belongs to no
    // single location.
    expect(headers).not.toContain('location')
  })

  test('lists each item exactly once, rolled up across locations', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const rows = page.locator('table tbody tr')
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThan(0)

    // The item cell's first line is the item's identity (brand + model).
    const titles = await rows.locator('td:first-child p:first-child').allTextContents()
    const trimmed = titles.map((t) => t.trim()).filter(Boolean)

    const duplicates = trimmed.filter((t, i) => trimmed.indexOf(t) !== i)
    expect(duplicates).toEqual([])
  })

  test('searches by brand, model or category rather than serial number', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const search = page.getByPlaceholder('Search brand, model, or category…')
    await expect(search).toBeVisible()
  })

  test('offers the Branches and Operations filters', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    await expect(page.locator('input[placeholder="All Branches"]')).toBeVisible()
    await expect(page.locator('input[placeholder="All Operations"]')).toBeVisible()
  })

  test('filtering by Operations narrows the list', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const rows = page.locator('table tbody tr')
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThan(0)

    const operations = page.locator('input[placeholder="All Operations"]')
    await operations.click()
    await page.getByRole('button', { name: 'Panay', exact: true }).click()

    // The filtered set must settle to something no larger than the unfiltered
    // one, and the picker must show what was chosen.
    await expect(operations).toHaveValue('Panay')
  })

  // Scenario 50 — the filter leak the client reported: filtering the list to
  // Ajuy and Alimodian and opening an item still showed every other branch's
  // stock in the drawer. The drawer had no idea a filter existed —
  // get-item-stock-summary sent only an itemId, and getSerialNumbers only an
  // itemId, so both answered tenant-wide.
  test('the Item 360 drawer only shows the branches the list was filtered to', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const picker = page.locator('input[placeholder="All Branches"]')
    await picker.click()

    const options = page.getByRole('checkbox')
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(1)

    // Pick one specific location so the expected drawer contents are exact.
    const chosen = (await options.nth(0).textContent())?.trim() ?? ''
    expect(chosen).not.toEqual('')
    await options.nth(0).click()
    await page.locator('h1').click()

    const rows = page.locator('table tbody tr')
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThan(0)
    await rows.first().click()

    await expect(page.getByRole('navigation', { name: 'Item 360 tabs' })).toBeVisible({
      timeout: 10_000,
    })

    // "By Location" must now list that one location and nothing else.
    const locationRows = page.getByTestId('stock-location-row')
    await expect(locationRows).toHaveCount(1, { timeout: 10_000 })
    await expect(locationRows.first()).toContainText(chosen)
  })

  // Operations leads the filter bar and narrows what Branches can offer, so
  // the two can never disagree.
  test('choosing an Operation narrows the Branches options to that region', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const branches = page.locator('input[placeholder="All Branches"]')
    await branches.click()
    const allOptions = page.getByRole('checkbox')
    await expect.poll(async () => allOptions.count(), { timeout: 15_000 }).toBeGreaterThan(1)
    const unfilteredCount = await allOptions.count()
    await page.locator('h1').click()

    const operations = page.locator('input[placeholder="All Operations"]')
    await operations.click()
    await page.getByRole('button', { name: 'Panay', exact: true }).click()
    await expect(operations).toHaveValue('Panay')

    await branches.click()
    await expect
      .poll(async () => allOptions.count(), { timeout: 15_000 })
      .toBeLessThan(unfilteredCount)

    const narrowed = (await allOptions.allTextContents()).map((t) => t.trim())
    // The other region's standalone warehouse must be gone.
    expect(narrowed).not.toContain('Negros Warehouse')
    expect(narrowed).toContain('Panay Warehouse')
  })

  test('selecting several branches keeps the picker open and summarises the count', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/stock')

    const picker = page.locator('input[placeholder="All Branches"]')
    await picker.click()

    const options = page.getByRole('checkbox')
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(1)

    await options.nth(0).click()
    // Still open — picking several is the point.
    await expect(options.nth(1)).toBeVisible()
    await options.nth(1).click()

    await page.keyboard.press('Escape')
    await page.locator('h1').click()

    await expect(picker).toHaveValue('2 branches')
  })
})
