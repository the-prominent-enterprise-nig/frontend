import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 27 (Warehouse Tier Correction) — the Stock page's warehouse
// filter, and 10 other Inventory pickers/filters like it, rendered the raw
// Warehouse row (`WH-20 — Ajuy Warehouse`) for what's actually a branch's
// own local stock, under a placeholder/subtitle that framed the whole page
// as warehouse-centric ("All Warehouses", "...across all warehouses").
// Branches and warehouses are different things: only the 2 real warehouses
// (PANAY, NEGROS) should ever read as "Warehouse" — everything else should
// show its real branch name, and the page framing itself should use the
// umbrella term "Location." Fixed by reading the same
// `wh.branch?.name ?? wh.name` fallback already used elsewhere in the app
// (Transfers, Reorder Rules, Costing) instead of the warehouse's own
// internal code/name, and renaming the placeholder/subtitle copy from
// "Warehouse(s)"/"Branch(es)" to "Location(s)".
test('Inventory > Stock location filter shows branch names, not raw WH-## codes, and the 2 real warehouses by their own name', async ({
  page,
}) => {
  await gotoReady(page, '/inventory/stock')

  await expect(page.getByText('across all locations', { exact: false })).toBeVisible()

  const select = page.locator('select').filter({ hasText: 'All Locations' })
  await expect(select).toBeVisible()

  // The warehouse list loads via a separate async query after navigation —
  // wait for it to actually populate past the static "All Locations" option.
  await expect(select.locator('option')).not.toHaveCount(1)

  const optionTexts = await select.locator('option').allTextContents()

  // A branch-local entry should read as the plain branch name — no raw
  // WH-## code, no "Warehouse" suffix.
  expect(optionTexts.some((t) => /^Ajuy$/.test(t.trim()))).toBe(true)
  expect(optionTexts.some((t) => t.includes('WH-20'))).toBe(false)
  expect(optionTexts.some((t) => t.trim() === 'Ajuy Warehouse')).toBe(false)

  // The 2 real warehouses keep reading as warehouses.
  expect(optionTexts.some((t) => t.trim() === 'Negros Warehouse')).toBe(true)
  expect(optionTexts.some((t) => t.trim() === 'Panay Warehouse')).toBe(true)
})
