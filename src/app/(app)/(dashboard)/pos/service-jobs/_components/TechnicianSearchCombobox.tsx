'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { searchUsers } from '../../_actions/pos-actions'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  initialLabel?: string
}

// Reuses the existing /users/search action (already used for cashier sign-in
// search) rather than inventing a new lookup. No role filter — a technician
// is "just staff" per the Aircool Closing Gap 4 fix, not a dedicated role.
export function TechnicianSearchCombobox({ value, onChange, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      initialLabel={initialLabel}
      queryKey="service-draft-technician-search"
      placeholder="Search staff by name or email…"
      typeToSearchMessage="Type to search staff…"
      emptyMessage="No staff found"
      search={async (query) => {
        const res = await searchUsers(query)
        return (res.data ?? []).map((u) => ({
          id: u.id,
          primary: u.name,
          secondary: u.email,
        }))
      }}
    />
  )
}
