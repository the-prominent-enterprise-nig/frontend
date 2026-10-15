'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  /** Scenario 72 — once a repair provider is chosen, only its items' units. */
  supplierId?: string
}

// Searches in-stock serials on the server as the user types, so every unit is
// findable, not just the first page of a preloaded list.
export function UdsSerialSearchCombobox({ value, onChange, error, supplierId }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      queryKey={`uds-serial-search-${supplierId ?? 'any'}`}
      placeholder="Search serial number…"
      typeToSearchMessage="Type to search serial numbers…"
      emptyMessage={
        supplierId ? "No matching units of this provider's items" : 'No matching serial numbers'
      }
      search={async (query) => {
        const res = await getSerialNumbers({
          search: query.trim() || undefined,
          status: 'in_stock',
          itemSupplierId: supplierId || undefined,
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
