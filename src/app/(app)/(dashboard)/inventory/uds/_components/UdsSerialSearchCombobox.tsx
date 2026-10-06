'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
}

// Searches in-stock serials on the server as the user types, so every unit is
// findable, not just the first page of a preloaded list.
export function UdsSerialSearchCombobox({ value, onChange, error }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      queryKey="uds-serial-search"
      placeholder="Search serial number…"
      typeToSearchMessage="Type to search serial numbers…"
      emptyMessage="No matching serial numbers"
      search={async (query) => {
        const res = await getSerialNumbers({
          search: query.trim() || undefined,
          status: 'in_stock',
          limit: 20,
        })
        return (res.success ? (res.data?.data ?? []) : []).map((s) => ({
          id: s.id,
          primary: s.serialNumber,
          secondary: s.item ? `${s.item.sku} ${s.item.name}` : undefined,
        }))
      }}
    />
  )
}
