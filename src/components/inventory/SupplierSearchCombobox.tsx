'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getSuppliers } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-suppliers'

type Props = {
  value: string
  onChange: (id: string) => void
  /** Fires alongside onChange with the full picked option, for callers that
   * need the supplier's name as well as its id — a screen that has to label
   * the choice back to the user, or filter a second lookup by it. */
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
}

export function SupplierSearchCombobox({ value, onChange, onSelect, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
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
