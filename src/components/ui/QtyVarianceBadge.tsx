export function QtyVarianceBadge({ ordered, received }: { ordered: number; received: number }) {
  const variance = received - ordered
  if (variance === 0)
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Exact
      </span>
    )
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        variance < 0 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
      }`}
    >
      {variance > 0 ? `+${variance}` : variance}
    </span>
  )
}
