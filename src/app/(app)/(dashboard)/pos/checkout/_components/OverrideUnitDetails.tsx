/** Nov UAT #28 — the unit a price override is applied to: its Brand, Type and
 * Serial Number(s). Shown in the override dialog and again in the order
 * summary, so whoever reviews the sale reads which unit was marked down. */
export type OverrideUnit = {
  brand: string | null
  type: string | null
  /** One per unit; two for a split-type item (indoor + outdoor). */
  serials: string[]
}

export default function UnitDetails({
  unit,
  compact = false,
}: {
  unit: OverrideUnit
  compact?: boolean
}) {
  const rows: Array<[string, string]> = [
    ['Brand', unit.brand?.trim() || '—'],
    ['Type', unit.type?.trim() || '—'],
    [unit.serials.length > 1 ? 'Serial Numbers' : 'Serial Number', unit.serials.join(', ') || '—'],
  ]
  return (
    <dl
      data-testid="override-unit-details"
      className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-gray-50 px-3 py-2 text-xs ${
        compact ? '' : 'mb-4'
      }`}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold text-gray-600">{label}</dt>
          <dd className="break-words text-gray-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
