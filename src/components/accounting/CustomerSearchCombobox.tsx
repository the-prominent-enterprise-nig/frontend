'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getCustomers, type Customer } from '@/src/libs/data/AccountingData'

type Props = {
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
  placeholder?: string
  disabled?: boolean
}

/** Matches kept on screen — the search narrows as more is typed. */
const RESULT_COUNT = 15

/**
 * A customer picked by typing — name, phone or email — and answered by the
 * server. The customer list has hundreds of thousands of rows, so a screen
 * that loads "the customers" into a dropdown only ever offers the first page
 * of them (the Customer Statement report offered 500, a New Special Account
 * 200): anyone further down the alphabet could not be picked at all.
 *
 * Same `accounting:customer:read` the old dropdowns' list call needed, so no
 * role loses access by switching to this.
 */
export function CustomerSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
  placeholder = 'Search customer by name, phone or email…',
  disabled,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      disabled={disabled}
      queryKey="accounting-customer-search"
      placeholder={placeholder}
      typeToSearchMessage="Type a name, phone or email to search…"
      emptyMessage="No customers found"
      search={async (query) => {
        const q = query.trim()
        if (!q) return []
        const res = await getCustomers({ search: q, limit: RESULT_COUNT })
        const payload = res.data
        const rows = (Array.isArray(payload) ? payload : (payload?.items ?? [])) as Customer[]
        return rows.map((c) => ({
          id: String(c.id),
          primary: c.name,
          secondary: [c.customerCode, c.phone].filter(Boolean).join(' · ') || undefined,
        }))
      }}
    />
  )
}
