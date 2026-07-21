'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { searchCustomers } from '../../_actions/pos-actions'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  initialLabel?: string
}

function customerDisplayName(c: { name?: string; firstName?: string; lastName?: string }) {
  return c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'
}

// Reuses the existing POS checkout customer search action rather than
// inventing a new CRM lookup.
export function CustomerSearchCombobox({ value, onChange, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      initialLabel={initialLabel}
      queryKey="service-draft-customer-search"
      placeholder="Search customer by name or phone…"
      typeToSearchMessage="No customer (optional) — type to search…"
      emptyMessage="No customers found"
      search={async (query) => {
        if (!query.trim()) return []
        const res = await searchCustomers(query.trim())
        return (res.data ?? []).map((c) => ({
          id: c.id,
          primary: customerDisplayName(c),
          secondary: c.phone ?? c.email,
        }))
      }}
    />
  )
}
