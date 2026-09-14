/** Scenario 46 — how the warehouse identifies a unit on a delivery:
 * BRAND · GROUP · MODEL. Falls back through whatever is present, and finally
 * to the catalogue name, so a part with no brand or model still reads as
 * something rather than going blank. */
export type TitleItem = {
  name?: string
  modelNumber?: string | null
  brand?: { name: string } | null
  primaryCategory?: { name: string; parentCategory?: { name: string } | null } | null
}

export function itemTitle(item?: TitleItem): string {
  // Group, not subgroup: a leaf category IS the subgroup, so its parent is the
  // group. Fall back to the category itself only when it has no parent, which
  // means it is already top-level.
  const group = item?.primaryCategory?.parentCategory?.name ?? item?.primaryCategory?.name
  const parts = [item?.brand?.name, group, item?.modelNumber].filter(Boolean)
  return parts.length ? parts.join(' ') : (item?.name ?? '')
}
