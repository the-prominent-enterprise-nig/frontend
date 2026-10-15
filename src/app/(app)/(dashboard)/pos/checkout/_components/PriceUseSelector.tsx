'use client'

import { useId } from 'react'
import { ChevronDown, Tag } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { PosPriceUseType } from '../../_actions/pos-actions'

type Props = {
  priceUseTypes: PosPriceUseType[]
  value: string
  onChange: (priceUseTypeId: string) => void
  isLoading?: boolean
  /** Smaller pill styling for inline use inside a cart row — each cart line
   * renders its own instance of this selector. */
  compact?: boolean
  /** No box at all — the Tag, the label and a chevron as plain text, for a flat
   * cart row where an outlined picker beside outlined buttons made the row busy.
   * Clicking the text still opens the native list. */
  bare?: boolean
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
  bare,
}: Props) {
  const id = useId()
  if (bare) {
    // A type-ahead list rather than a native select: the business keeps its own
    // price categories (WIP, CR-BR, SSC…), and scrolling a long one on every
    // cart line was slow. Portalled — the cart is a scrolling card, which would
    // clip an in-flow list. The border is a step up from the bare text it
    // replaced (that read as a label, not a control), still lighter than a form
    // field.
    return (
      <SearchableSelect
        value={value}
        onChange={(v) => onChange(v)}
        options={priceUseTypes.map((t) => ({ value: t.id, label: t.name }))}
        placeholder="Price use…"
        ariaLabel="Price Use"
        icon={<Tag size={14} />}
        disabled={isLoading}
        portal
        className="w-48"
        chrome={{
          idle: 'border-gray-300 hover:border-purple-400',
          focused: 'border-prominent-purple-500 ring-1 ring-prominent-purple-500',
        }}
      />
    )
  }
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
        className="min-w-0 flex-1 truncate border-none bg-transparent text-sm font-medium text-gray-900 outline-none disabled:opacity-50"
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
