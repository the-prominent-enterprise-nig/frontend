import { HelpCircle } from 'lucide-react'

const COLORS: Record<'pink' | 'green' | 'blue', string> = {
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
}

/**
 * `color` is a deduped, slash-joined string (e.g. "green/blue") since an
 * account can be flagged on both the arrears and not-moving axes at once —
 * see AgingInfo in schema/crm/types.ts. Renders one pill per token, styled
 * by the first recognized token. No "red" — verified absent from 14,420
 * rows of the client's own June 2026 export.
 */
export default function AgingColorBadge({ color }: { color?: string | null }) {
  if (!color) return <span className="text-gray-400">—</span>
  const tokens = color.split('/')
  const swatch =
    COLORS[tokens[0] as keyof typeof COLORS] ?? 'bg-gray-50 text-gray-700 ring-gray-200'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${swatch}`}
      title="Aging flags, reverse-engineered from the client's June 2026 AR export — exact month thresholds not yet explicitly signed off"
    >
      {color}
      <HelpCircle className="h-3 w-3 opacity-60" />
    </span>
  )
}
