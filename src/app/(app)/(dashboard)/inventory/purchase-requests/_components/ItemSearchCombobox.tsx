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
}

export function ItemSearchCombobox({ value, onChange, onSelect, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      queryKey="items-search"
      placeholder="Search item by name or SKU…"
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
