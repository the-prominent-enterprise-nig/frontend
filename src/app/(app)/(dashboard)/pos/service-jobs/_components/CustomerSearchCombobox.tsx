'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { searchCustomers } from '../../_actions/pos-actions'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  initialLabel?: string
}

/** How many recent customers the field offers before anyone types. */
const RECENT_COUNT = 5

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
        // SearchCombobox calls this with '' the moment the field opens. The
        // POS search treats that as "match everything", so the field can show
        // the most recent customers straight away instead of an empty box
        // that gives no sign it is going to work. Trimmed to RECENT_COUNT:
        // this is a head start on the common case, not a browsable list, and
        // a full ten unranked names reads like a failed search.
        const res = await searchCustomers(query.trim())
        const rows = res.data ?? []
        return (query.trim() ? rows : rows.slice(0, RECENT_COUNT)).map((c) => ({
          id: c.id,
          primary: customerDisplayName(c),
          secondary: c.phone ?? c.email,
        }))
      }}
    />
  )
}
