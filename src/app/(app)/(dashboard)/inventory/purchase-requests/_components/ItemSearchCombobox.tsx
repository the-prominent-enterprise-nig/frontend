'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'

export type ItemSearchMeta = {
  costPrice: number | null
  isSerialTracked: boolean
  isBatchTracked: boolean
}

type Props = {
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
  /** Dense row height, to match the other controls on a line-item row. */
  compact?: boolean
  /** Overrides the default, which is too long for a narrow grid column. */
  placeholder?: string
  /** Greys the box out — for a picker whose surrounding context (supplier,
   * invoice, warehouse) has to be settled before an item can mean anything. */
  disabled?: boolean
  /** Drops serial-tracked items from the results — for a picker whose flow
   * has no way to capture the arriving unit's actual serial (e.g. a
   * transfer's unlisted-item receipt line, which only records a bare
   * quantity). Without this, a serial-tracked pick either silently
   * fabricates stock with no addressable serial, or gets rejected by the
   * backend after the rest of the form is filled in. */
  excludeSerialTracked?: boolean
}

export function ItemSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
  compact,
  placeholder = 'Search item by name or SKU…',
  disabled,
  excludeSerialTracked,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      compact={compact}
      disabled={disabled}
      queryKey="items-search"
      placeholder={placeholder}
      typeToSearchMessage="Type to search items…"
      emptyMessage="No items found"
      search={async (query) => {
        const res = await getItems({ search: query || undefined, limit: 20, lifecycle: 'active' })
        const items = res.data?.data ?? []
        return items
          .filter((item) => !excludeSerialTracked || !item.isSerialTracked)
          .map((item) => ({
            id: item.id,
            primary: item.name,
            secondary: item.sku,
            meta: {
              costPrice: item.costPrice ?? null,
              isSerialTracked: item.isSerialTracked ?? false,
              isBatchTracked: item.isBatchTracked ?? false,
            } satisfies ItemSearchMeta,
          }))
      }}
    />
  )
}
