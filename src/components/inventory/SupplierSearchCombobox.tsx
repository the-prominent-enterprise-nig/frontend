'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getSuppliers } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-suppliers'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
}

export function SupplierSearchCombobox({ value, onChange, error }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      queryKey="suppliers-search"
      placeholder="Search supplier by name or code…"
      typeToSearchMessage="Type to search suppliers…"
      emptyMessage="No suppliers found"
      search={async (query) => {
        const res = await getSuppliers({ search: query || undefined, limit: 20 })
        return (res.data?.data ?? []).map((s) => ({
          id: s.id,
          primary: s.name,
          secondary: s.code,
        }))
      }}
    />
  )
}
