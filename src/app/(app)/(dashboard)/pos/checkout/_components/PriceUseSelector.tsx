'use client'

import { Tag } from 'lucide-react'
import type { PosPriceUseType } from '../../_actions/pos-actions'

type Props = {
  priceUseTypes: PosPriceUseType[]
  value: string
  onChange: (priceUseTypeId: string) => void
  isLoading?: boolean
}

/** Selected once for the whole sale — every cart line's price resolves
 * against whichever Price Use is picked here (WIP/CR-BR/SSC/PROMO/etc.),
 * the client's real, user-managed price categories, not a hardcoded set. */
export default function PriceUseSelector({ priceUseTypes, value, onChange, isLoading }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <Tag size={14} className="shrink-0 text-gray-400" />
      <label htmlFor="price-use-type" className="shrink-0 text-xs font-semibold text-gray-600">
        Price Use
      </label>
      <select
        id="price-use-type"
        name="priceUseTypeId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className="flex-1 border-none bg-transparent text-sm font-medium text-gray-900 outline-none disabled:opacity-50"
      >
        <option value="">Select price use…</option>
        {priceUseTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  )
}
