// Permissions that a module wildcard can never hand out. Mirrors the backend's
// src/auth/explicit-only-permissions.ts.
//
// `accounting:*:*` and `pos:*:*` match every permission in their module, which
// is how a "Business Owner only" permission ends up in the wrong hands. These
// two let a person change an entry that is already recorded, so a role holds
// them only through the row itself (the Business Owner holds every row), never
// a wildcard. An owner can still tick them for another role under
// Settings › Roles & Access › Advanced.

/** Edit a recorded Expense, Payables entry, Inter-Account Transfer or
 * Collected Funds History deposit. A reason is required with every edit. */
export const RECORDED_ENTRIES_EDIT = 'accounting:recorded-entries:edit'

/** Edit a New Receipt in POS. A reason is required with every edit. */
export const NEW_RECEIPTS_EDIT = 'pos:new-receipts:edit'

const EXPLICIT_ONLY: ReadonlySet<string> = new Set([RECORDED_ENTRIES_EDIT, NEW_RECEIPTS_EDIT])

export function isExplicitOnlyPermission(permission: string): boolean {
  return EXPLICIT_ONLY.has(permission)
}

/** The same test for a permission row from the catalogue. */
export function isExplicitOnlyRow(row: {
  module: string
  resource: string
  action: string
}): boolean {
  return EXPLICIT_ONLY.has(`${row.module}:${row.resource}:${row.action}`)
}
