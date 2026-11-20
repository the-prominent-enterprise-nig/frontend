'use client'

import { useState } from 'react'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import {
  ItemSearchCombobox,
  type ItemSearchMeta,
} from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox'

/** The item a receiver picked as what actually arrived. */
export type ArrivedItem = {
  id: string
  label: string
  sku?: string
  isSerialTracked: boolean
}

export function toArrivedItem(option: SearchComboboxOption): ArrivedItem {
  const meta = option.meta as ItemSearchMeta | undefined
  return {
    id: option.id,
    label: option.primary,
    sku: option.secondary,
    isSerialTracked: !!meta?.isSerialTracked,
  }
}

/**
 * A link that opens an item search, for "a different model arrived" on a PO
 * line or "a unit not on the PO" below them. The supplier's own items come
 * first, then the rest of the catalog.
 */
export function ArrivedItemPicker({
  label,
  supplierId,
  onPick,
}: {
  label: string
  supplierId?: string
  onPick: (item: ArrivedItem) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[11.5px] text-[#5b21b6] underline decoration-transparent underline-offset-2 hover:decoration-current"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex w-full max-w-[420px] items-center gap-2">
      <div className="min-w-0 flex-1">
        <ItemSearchCombobox
          value={value}
          onChange={setValue}
          onSelect={(o) => {
            onPick(toArrivedItem(o))
            setValue('')
            setOpen(false)
          }}
          supplierId={supplierId}
          compact
          placeholder="Search the item that arrived…"
        />
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="shrink-0 text-[11.5px] text-ink-muted hover:text-[#17171c]"
      >
        Cancel
      </button>
    </div>
  )
}
