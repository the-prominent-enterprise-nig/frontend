/** Classification lookup names (Group/Subgroup/Item Type) are free-text and often
 * underscore-separated (e.g. "Split_Type") — render them with spaces for readability. */
export function formatClassificationLabel(name: string): string {
  return name.replace(/_/g, ' ')
}

/** Same as formatClassificationLabel, but also treats the "Unclassified"
 * placeholder (assigned when serialized import couldn't determine a real
 * type/category for a row) as if it were empty — renders as "—" like any
 * other missing field instead of showing a placeholder value. Does not
 * affect the underlying data, only what's displayed. */
export function displayClassificationLabel(name: string | null | undefined): string | undefined {
  if (!name || name === 'Unclassified') return undefined
  return formatClassificationLabel(name)
}
