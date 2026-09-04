'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'

export type ItemSearchMeta = {
  costPrice: number | null
  isSerialTracked: boolean
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
}

export function ItemSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
  compact,
  placeholder = 'Search item by name or SKU…',
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      compact={compact}
      queryKey="items-search"
      placeholder={placeholder}
      typeToSearchMessage="Type to search items…"
      emptyMessage="No items found"
      search={async (query) => {
        const res = await getItems({ search: query || undefined, limit: 20, lifecycle: 'active' })
        return (res.data?.data ?? []).map((item) => ({
          id: item.id,
          primary: item.name,
          secondary: item.sku,
          meta: {
            costPrice: item.costPrice ?? null,
            isSerialTracked: item.isSerialTracked ?? false,
          } satisfies ItemSearchMeta,
        }))
      }}
    />
  )
}
