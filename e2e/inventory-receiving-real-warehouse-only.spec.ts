import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Receiving moved to the Stock hub: /inventory/operations?tab=receiving is
// gone and the entry point is the Receiving Reports tab's "New Receipt"
// button, which opens the same ReceiveStockModal (heading: "Receive Stock").

// Scenario 27 Part 3 restricted the receive form's "Destination Location"
// picker to the 2 real warehouses, hiding the 41 branch-local stock locations
// outright. The picker now offers both, because a delivery raised against a
// branch's own purchase order legitimately lands at that branch — the rule that
// matters is still enforced server-side (stock.service.ts only accepts a branch
// location when the receipt is linked to a PO raised for that branch).
//
// What this spec holds onto from Scenario 27: the two real warehouses lead the
// list and every branch entry is marked as one, so a receiver picking a plain
// destination cannot fall into a branch location by accident.
test('Receive Stock destination leads with the real warehouses and marks the branches', async ({
  page,
}) => {
  await gotoReady(page, '/inventory/stock?tab=reports')

  const label = page.getByText('Destination Location', { exact: false })
  await clickStable(page.getByRole('button', { name: 'New Receipt' }), label)

  // A type-ahead (SearchableSelect), not a native <select>: clicking the box
  // opens a list of option buttons carrying this testid.
  await page.getByPlaceholder('Select location…').click()
  const options = page.locator('[data-testid="searchable-select-option"]')
  await expect(options.first()).toBeVisible({ timeout: 10_000 })

  const labels = (await options.allTextContents()).map((t) => t.trim()).filter(Boolean)

  const warehouses = labels.filter((l) => !l.endsWith('(branch)'))
  expect([...warehouses].sort()).toEqual(['Negros Warehouse', 'Panay Warehouse'])

  // The branches are offered too, each one marked, and none of them ahead of
  // the warehouses.
  const branches = labels.filter((l) => l.endsWith('(branch)'))
  expect(branches.length).toBeGreaterThan(0)
  expect(labels.slice(0, warehouses.length).every((l) => !l.endsWith('(branch)'))).toBeTruthy()
})
