import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 27 (Warehouse Tier Correction) — the Stock page's location filter,
// and 10 other Inventory pickers/filters like it, rendered the raw Warehouse
// row (`WH-20 — Ajuy Warehouse`) for what's actually a branch's own local
// stock. Branches and warehouses are different things: only the 2 real
// warehouses (PANAY, NEGROS) should ever read as "Warehouse" — everything
// else shows its real branch name.
//
// Scenario 50 — retargeted at the rebuilt "All Branches" multi-select, and
// tightened off `.some(...)` onto exact counts. The client reported seeing
// "2 Panay warehouses"; the old assertions could not have caught that,
// because `.some()` is just as true of one match as of two. The cause was
// this picker listing all 43 warehouse rows (the 2 real ones plus 41
// per-branch shadow warehouses) and labelling each `branch?.name ?? name`,
// collapsing distinct rows onto one visible label. It now lists real
// branches plus the 2 standalone warehouses, which cannot collide.
test('Inventory > Stock branches filter lists each location exactly once, with no raw WH-## codes', async ({
  page,
}) => {
  await gotoReady(page, '/inventory/stock')

  const picker = page.locator('input[placeholder="All Branches"]')
  await expect(picker).toBeVisible()
  await picker.click()

  const options = page.getByRole('checkbox')
  // The branch/warehouse lists load via separate async queries after
  // navigation — wait for them to actually populate.
  await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(1)

  const optionTexts = (await options.allTextContents()).map((t) => t.trim())

  const countOf = (label: string) => optionTexts.filter((t) => t === label).length

  // The duplicate the client actually reported: exactly one, not two.
  expect(countOf('Panay Warehouse')).toBe(1)
  expect(countOf('Negros Warehouse')).toBe(1)

  // A branch-local entry reads as the plain branch name — no raw WH-## code,
  // no "Warehouse" suffix, and never twice.
  expect(countOf('Ajuy')).toBe(1)
  expect(optionTexts.filter((t) => t.includes('WH-'))).toHaveLength(0)
  expect(countOf('Ajuy Warehouse')).toBe(0)

  // Nothing at all may appear twice — this is the assertion that fails the
  // build if the duplicate ever comes back, for any location.
  //
  // "E2E "-prefixed rows are excluded because they are other specs' leaked
  // fixtures, not real locations: inventory-serial-level-counting.spec.ts
  // creates a standalone warehouse with a unique CODE but a fixed NAME
  // ('E2E Isolated Serial Count Warehouse') and never deletes it, so the
  // test DB accumulates one more on every run. That leak is worth fixing in
  // that spec; it is not what this assertion is about.
  const realLocations = optionTexts.filter((t) => !t.startsWith('E2E '))
  const duplicates = realLocations.filter((t, i) => realLocations.indexOf(t) !== i)
  expect(duplicates).toEqual([])
})
