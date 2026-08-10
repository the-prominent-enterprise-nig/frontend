'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { searchApplicantCustomers } from '../_actions/search-applicants'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  initialLabel?: string
}

export function ApplicantSearchCombobox({ value, onChange, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      initialLabel={initialLabel}
      queryKey="credit-application-applicant-search"
      placeholder="Search customer by name or phone…"
      typeToSearchMessage="Type to search for the applicant…"
      emptyMessage="No customers found"
      search={async (query) => {
        if (!query.trim()) return []
        const res = await searchApplicantCustomers(query.trim())
        return (res.data ?? []).map((c) => ({
          id: c.id,
          primary: c.name ?? c.phone ?? c.email ?? 'Unknown',
          secondary: c.phone ?? c.email ?? undefined,
        }))
      }}
    />
  )
}
