import { HelpCircle } from 'lucide-react'
import type { AgingColor } from '@/src/schema/crm/types'

const COLORS: Record<AgingColor, string> = {
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
}

/**
 * PROVISIONAL aging color tag — thresholds are not yet confirmed by the
 * client (see AgingColor type in schema/crm/types.ts). The "?" marks this
 * clearly as unconfirmed business logic so it isn't mistaken for a settled
 * rule.
 */
export default function AgingColorBadge({ color }: { color?: AgingColor | null }) {
  if (!color) return <span className="text-gray-400">—</span>
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${COLORS[color]}`}
      title="Provisional — aging color thresholds pending client confirmation"
    >
      {color}
      <HelpCircle className="h-3 w-3 opacity-60" />
    </span>
  )
}
