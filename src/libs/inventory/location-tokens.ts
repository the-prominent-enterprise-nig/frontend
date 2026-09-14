/**
 * Scenario 50 — one picker, two kinds of location.
 *
 * The Stock Balance screen filters by "location", which is either a branch
 * (whose warehouses carry its branchId) or one of the 2 standalone
 * warehouses, which belong to no branch at all and so can never be reached
 * by a branch id. A single combobox has to offer both without the ids
 * colliding, so each option carries its kind as a prefix and the pair is
 * split apart again before it reaches the API.
 *
 * Shared because the selection outlives the list: the Item 360 drawer
 * inherits whatever was filtered when it was opened, so both sides need the
 * same split.
 */
export type LocationToken = string

export function branchToken(branchId: string): LocationToken {
  return `branch:${branchId}`
}

export function warehouseToken(warehouseId: string): LocationToken {
  return `warehouse:${warehouseId}`
}

export function splitLocationTokens(tokens: LocationToken[] = []): {
  branchIds: string[]
  warehouseIds: string[]
} {
  const branchIds: string[] = []
  const warehouseIds: string[] = []
  for (const token of tokens) {
    const separator = token.indexOf(':')
    if (separator === -1) continue
    const kind = token.slice(0, separator)
    const id = token.slice(separator + 1)
    if (!id) continue
    if (kind === 'branch') branchIds.push(id)
    else if (kind === 'warehouse') warehouseIds.push(id)
  }
  return { branchIds, warehouseIds }
}
