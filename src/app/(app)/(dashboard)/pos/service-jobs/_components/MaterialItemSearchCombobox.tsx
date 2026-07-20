'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  initialLabel?: string
}

// Mirrors purchase-requests' ItemSearchCombobox, but a materials estimate
// line must only ever reference a physical/stock item — never another
// service (there's no server-side isService filter on GET /inventory/items,
// so this filters the search results client-side).
export function MaterialItemSearchCombobox({ value, onChange, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      initialLabel={initialLabel}
      queryKey="service-draft-material-items-search"
      placeholder="Search material by name or SKU…"
      typeToSearchMessage="Type to search materials…"
      emptyMessage="No materials found"
      search={async (query) => {
        const res = await getItems({ search: query || undefined, limit: 20, lifecycle: 'active' })
        return (res.data?.data ?? [])
          .filter((item) => item.isService !== true)
          .map((item) => ({
            id: item.id,
            primary: item.name,
            secondary: item.sku,
          }))
      }}
    />
  )
}
