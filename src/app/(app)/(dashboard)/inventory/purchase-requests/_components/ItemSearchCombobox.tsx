'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
}

export function ItemSearchCombobox({ value, onChange, error }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      queryKey="items-search"
      placeholder="Search item"
      typeToSearchMessage="Type to search items…"
      emptyMessage="No items found"
      search={async (query) => {
        const res = await getItems({ search: query || undefined, limit: 20, lifecycle: 'active' })
        return (res.data?.data ?? []).map((item) => ({
          id: item.id,
          primary: item.name,
          secondary: item.sku,
        }))
      }}
    />
  )
}
