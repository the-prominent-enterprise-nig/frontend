import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 27 Part 3 — goods receiving (both manual and PO-based) now
// always lands in one of the 2 real warehouses, never a branch's own local
// stock. The "Destination Warehouse" picker used to list all 41
// branch-local warehouses (relabeled to branch names); it should now list
// exactly PANAY and NEGROS.
test('Receive Stock modal offers only the 2 real warehouses as the destination', async ({
  page,
}) => {
  await gotoReady(page, '/inventory/operations?tab=receiving')

  const label = page.getByText('Destination Warehouse', { exact: false })
  await clickStable(page.getByRole('button', { name: 'Receive Stock' }), label)

  const select = page.locator('select').filter({ hasText: 'Select warehouse…' })
  await expect(select).toBeVisible()

  // Loads via an async query — wait for it to populate past the placeholder.
  await expect(select.locator('option')).not.toHaveCount(1)

  const optionTexts = (await select.locator('option').allTextContents())
    .map((t) => t.trim())
    .filter((t) => t !== 'Select warehouse…')

  expect(optionTexts.sort()).toEqual(['Negros Warehouse', 'Panay Warehouse'])
})
