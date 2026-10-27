import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 22 Part 10, updated for Scenario 74's module map (Modules and
// Sharing Plan). Roles & Access reads each module as "Module: access level":
// All access, All access * (everything but protected steps), Partial (k of n
// features) or nothing. The old per-resource grading ("Mixed", "Manage /
// Edit") over- or under-stated access: one unrelated create permission read
// as Manage / Edit, and a leftover row next to a module wildcard read as
// Mixed. Procurement is no longer its own module (folded into Inventory).

async function openManageAccess(page: import('@playwright/test').Page, role: RegExp) {
  await gotoReady(page, '/settings/roles')
  await page.getByRole('row', { name: role }).getByRole('button').last().click()
  await clickStable(
    page.getByRole('link', { name: 'Manage Access' }),
    page.getByRole('heading', { name: 'Module access' })
  )
}

// Branch Manager holds accounting:customer-advances:create next to otherwise
// read-only accounting access — genuinely partial, and named as such.
test('Branch Manager reads Accounting as Partial, not Manage / Edit or Mixed', async ({ page }) => {
  await gotoReady(page, '/settings/roles')

  const branchManagerRow = page.getByRole('row', { name: /^Branch Manager/ })
  await expect(branchManagerRow).toBeVisible()
  await expect(branchManagerRow.getByText(/^Accounting: Partial \(\d+ of \d+\)$/)).toBeVisible()
  await expect(branchManagerRow.getByText(/: (Mixed|Edit)$/)).toHaveCount(0)
})

// A role holding a single module-wildcard row (Branch Manager's pos:*:*)
// grants every capability in that module; the caption counts coverage, not
// raw rows, and the Full Access button reads as the current level.
test('A module wildcard grant shows "N of N" coverage and Full Access', async ({ page }) => {
  await openManageAccess(page, /^Branch Manager/)

  const posRow = page.locator('div.relative.px-6', {
    has: page.getByRole('button', { name: /^Point of Sale/ }),
  })
  await expect(posRow.locator('[data-module-summary="pos"]')).toHaveText('All access')
  const captionText = await posRow.getByText(/\d+ of \d+ capabilities/).textContent()
  const match = captionText?.match(/(\d+) of (\d+) capabilities/)
  expect(match).not.toBeNull()
  const [, selected, total] = match!
  expect(selected).toBe(total)
  await expect(posRow.getByRole('button', { name: 'Full Access', exact: true })).toHaveClass(
    /bg-prominent-purple-700/
  )
})

// Business Owner holds every module wildcard; every module reads All access.
test('Business Owner reads All access for every module, never partial', async ({ page }) => {
  await gotoReady(page, '/settings/roles')

  const businessOwnerRow = page.getByRole('row', { name: /^Business Owner/ })
  await expect(businessOwnerRow).toBeVisible()
  await expect(businessOwnerRow.getByText(/Partial|Mixed/)).toHaveCount(0)
  for (const moduleLabel of ['Accounting', 'Inventory', 'Point of Sale', 'CRM']) {
    await expect(
      businessOwnerRow.getByText(`${moduleLabel}: All access`, { exact: true })
    ).toBeVisible()
  }
})

// Scenario 74 review: the Accountant holds accounting:*:* plus rows older
// backfills added next to it (inventory-debit-memos, restricted VAT). Graded
// one by one, those made the whole module read "Mixed". Holding the module
// wildcard is the whole module, so it reads All access.
test('Accountant reads All access for Accounting, not Mixed', async ({ page }) => {
  await gotoReady(page, '/settings/roles')

  const accountantRow = page.getByRole('row', { name: /^Accountant/ })
  await expect(accountantRow).toBeVisible()
  await expect(accountantRow.getByText('Accounting: All access', { exact: true })).toBeVisible()
  await expect(accountantRow.getByText(/^Accounting: (Mixed|Partial)/)).toHaveCount(0)
})
