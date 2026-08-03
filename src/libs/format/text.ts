/** Classification lookup names (Group/Subgroup/Item Type) are free-text and often
 * underscore-separated (e.g. "Split_Type") — render them with spaces for readability. */
export function formatClassificationLabel(name: string): string {
  return name.replace(/_/g, ' ')
}
