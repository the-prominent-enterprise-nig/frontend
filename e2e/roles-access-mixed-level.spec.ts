import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

// Scenario 22 Part 10 — the "Module Access" badges and the module-toggle
// buttons in "Manage Role Access" both used to OR every permission's
// action across an ENTIRE module together, so a single unrelated create
// permission on a minor resource flipped the whole module's badge to
// "Manage / Edit" — even when every other resource in it stayed strictly
// read-only. Branch Manager is a live example: it holds
// accounting:customer-advances:create (an unrelated POS-reservation-
// deposit permission) alongside otherwise read-only accounting access
// (journalEntry, ar-invoices, budget, supplier-debit-memos, etc. are all
// :read only). The fix groups by resource first, so this now correctly
// shows as "Mixed Access" instead of falsely claiming uniform manage/edit
// access across the whole module.
test('Branch Manager shows Mixed Access for Accounting, not a false Manage / Edit', async ({
  page,
}) => {
  await gotoReady(page, '/settings/roles')

  const branchManagerRow = page.getByRole('row', { name: /Branch Manager/ })
  await expect(branchManagerRow).toBeVisible()

  // The table badge should read "Accounting: Mixed Access", not
  // "Accounting: Manage / Edit".
  await expect(
    branchManagerRow.getByText('Accounting: Mixed Access', { exact: true })
  ).toBeVisible()
  await expect(
    branchManagerRow.getByText('Accounting: Manage / Edit', { exact: true })
  ).toHaveCount(0)

  // Open "Manage Role Access" and confirm the Accounting row itself shows
  // the mixed-state explanation and doesn't falsely highlight any single
  // level button as the current state.
  const modalHeading = page.getByRole('heading', { name: 'Manage Role Access' })
  await clickStable(branchManagerRow.getByRole('button', { name: /permissions/ }), modalHeading)

  await expect(page.getByText('Different resources in this module').first()).toBeVisible()

  const accountingRow = page.locator('div.rounded-xl', {
    has: page.getByRole('heading', { name: 'Accounting', exact: true }),
  })
  for (const label of ['No Access', 'View Only', 'Manage / Edit', 'Full Access']) {
    const button = accountingRow.getByRole('button', { name: label, exact: true })
    await expect(button).toBeVisible()
    // None of the 4 settable levels should render as the active/selected
    // button when the true state is mixed — that's the whole point of the
    // fix (an admin should never see a level look "already confirmed" when
    // it doesn't uniformly apply).
    await expect(button).not.toHaveClass(/bg-prominent-purple-700/)
  }
})

// Coverage half of Part 10 — the toggle previously only covered 4 of 8
// permission modules (accounting/inventory/pos/crm); procurement, admin,
// sales, and files had no toggle row at all, only reachable via the
// Advanced permissions search. Branch Manager holds the full
// procurement:*:* wildcard (Scenario 22 Part 11), so its Procurement row
// is a real, non-trivial case — not just an empty "No Access" row.
test('Procurement module now has its own toggle row, not just Accounting/Inventory/POS/CRM', async ({
  page,
}) => {
  await gotoReady(page, '/settings/roles')

  const branchManagerRow = page.getByRole('row', { name: /Branch Manager/ })
  await expect(branchManagerRow).toBeVisible()
  await expect(branchManagerRow.getByText(/Procurement:/)).toBeVisible()

  const modalHeading = page.getByRole('heading', { name: 'Manage Role Access' })
  await clickStable(branchManagerRow.getByRole('button', { name: /permissions/ }), modalHeading)

  const procurementRow = page.locator('div.rounded-xl', {
    has: page.getByRole('heading', { name: 'Procurement', exact: true }),
  })
  await expect(procurementRow).toBeVisible()
  await expect(procurementRow.getByText(/\d+ of \d+ capabilities enabled/)).toBeVisible()
})

// A role holding a single module-wildcard permission row (e.g.
// procurement:*:*) genuinely grants every capability in that module, but
// the caption used to count raw RolePermission rows, not actual coverage
// — showing something like "1 of 23 capabilities enabled" right next to a
// highlighted "Full Access" button, a flatly contradictory pair. Branch
// Manager's real grant (Part 11) makes this concretely checkable: full
// wildcard modules should show N of N, not 1 of N.
test('A module wildcard grant shows accurate "N of N" coverage, not a misleading raw row count', async ({
  page,
}) => {
  await gotoReady(page, '/settings/roles')

  const branchManagerRow = page.getByRole('row', { name: /Branch Manager/ })
  const modalHeading = page.getByRole('heading', { name: 'Manage Role Access' })
  await clickStable(branchManagerRow.getByRole('button', { name: /permissions/ }), modalHeading)

  const procurementRow = page.locator('div.rounded-xl', {
    has: page.getByRole('heading', { name: 'Procurement', exact: true }),
  })
  const captionText = await procurementRow
    .getByText(/\d+ of \d+ capabilities enabled/)
    .textContent()
  const match = captionText?.match(/(\d+) of (\d+) capabilities enabled/)
  expect(match).not.toBeNull()
  const [, selected, total] = match!
  expect(selected).toBe(total)

  const fullAccessButton = procurementRow.getByRole('button', { name: 'Full Access', exact: true })
  await expect(fullAccessButton).toHaveClass(/bg-prominent-purple-700/)
})

// Business Owner's grant (`permissions.map((p) => p.id)` in seed.ts) is
// only recomputed when the seed script actually runs — a Permission row
// created directly against the live DB (as this scenario's Parts 7 and 11
// both did, for items:create/update-adjacent grants and the accounting
// resource-wildcards/files:*:* rows) doesn't automatically backfill onto
// Business Owner. That gap showed up here first: the table badge read
// "Accounting: Mixed Access" for a role that's supposed to hold literally
// every permission. Fixed by backfilling the live DB; this locks in every
// module reading Full Access, not just Accounting.
test('Business Owner shows Full Access for every module, never Mixed or partial', async ({
  page,
}) => {
  await gotoReady(page, '/settings/roles')

  // Business Owner's permissions are fixed and un-editable (RolesSection.tsx
  // renders a plain badge, not a clickable "Manage Role Access" button, for
  // isFounderRole) — so this checks the row-level module badges directly,
  // the same ones visible in the table without opening any modal.
  const businessOwnerRow = page.getByRole('row', { name: /Business Owner/ })
  await expect(businessOwnerRow).toBeVisible()
  await expect(businessOwnerRow.getByText(/Mixed Access/)).toHaveCount(0)

  for (const moduleLabel of [
    'Accounting',
    'Inventory',
    'Point of Sale',
    'CRM',
    'Procurement',
    'Admin',
    'Sales',
    'Files',
  ]) {
    await expect(
      businessOwnerRow.getByText(`${moduleLabel}: Full Access`, { exact: true })
    ).toBeVisible()
  }
})
