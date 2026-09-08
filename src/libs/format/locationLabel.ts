/**
 * How a stock location reads on screen.
 *
 * Each branch owns exactly one warehouse, stored as "{branch} Warehouse"
 * with a WH-xx code. Neither of those is what staff call the place — they
 * say "Bago", and every location picker in the app lists it that way — so
 * a branch's location renders as the branch alone. Only the genuinely
 * standalone warehouses (Negros, Panay, which belong to no branch) keep
 * their own name, because that is what they are actually called.
 *
 * Accepts either shape the API returns: an embedded `branch` when the
 * query included it, or just `branchId` when it did not, in which case the
 * suffix is trimmed off the warehouse's own name.
 *
 * Warehouse-administration screens are the deliberate exception and do not
 * use this — there, the warehouse and its code ARE the subject.
 *
 * The em-dash fallback suits display. Somewhere expecting "no value" —
 * a combobox `initialLabel`, a search haystack — should guard on the
 * warehouse first or pass an empty `fallback`, or the dash becomes a
 * confirmed value and hides the placeholder behind it.
 */
export function locationLabel(
  warehouse?: {
    name: string
    branchId?: string | null
    branch?: { name: string } | null
  } | null,
  fallback = '—'
): string {
  if (!warehouse) return fallback
  if (warehouse.branch?.name) return warehouse.branch.name
  if (warehouse.branchId) return warehouse.name.replace(/\s+Warehouse$/i, '')
  return warehouse.name
}
