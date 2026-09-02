'use client'

import { useId } from 'react'
import { ChevronDown, Tag } from 'lucide-react'
import type { PosPriceUseType } from '../../_actions/pos-actions'

type Props = {
  priceUseTypes: PosPriceUseType[]
  value: string
  onChange: (priceUseTypeId: string) => void
  isLoading?: boolean
  /** Smaller pill styling for inline use inside a cart row — each cart line
   * renders its own instance of this selector. */
  compact?: boolean
}

/** Each cart line owns one of these — a sale can mix items resolved under
 * different Price Use types (WIP/CR-BR/SSC/etc.), the client's real,
 * user-managed price categories, not a hardcoded set. */
export default function PriceUseSelector({
  priceUseTypes,
  value,
  onChange,
  isLoading,
  compact,
}: Props) {
  const id = useId()
  if (compact) {
    // The native <select> only registers clicks on its own rendered box —
    // sizing it to just the selected text (w-fit) left the rest of the pill
    // dead space. Instead it's stretched to cover the whole pill (absolute
    // inset-0, invisible) so a click anywhere in the box opens it; the Tag/
    // label/chevron underneath are purely visual.
    const selectedLabel = priceUseTypes.find((t) => t.id === value)?.name ?? 'Price use…'
    return (
      <div
        className={`relative flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 ${isLoading ? 'opacity-50' : ''}`}
      >
        <Tag size={12} className="shrink-0 text-gray-400" />
        <label htmlFor={id} className="sr-only">
          Price Use
        </label>
        <span className="flex-1 truncate text-xs font-medium text-gray-700">{selectedLabel}</span>
        <ChevronDown size={12} className="shrink-0 text-gray-400" />
        <select
          id={id}
          name="priceUseTypeId"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none border-none bg-transparent opacity-0 disabled:cursor-not-allowed"
        >
          <option value="">Price use…</option>
          {priceUseTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <Tag size={14} className="shrink-0 text-gray-400" />
      <label htmlFor={id} className="sr-only">
        Price Use
      </label>
      <select
        id={id}
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
