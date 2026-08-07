'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getBranches } from '../../_actions/pos-actions'

type Props = {
  value: string
  onChange: (id: string) => void
  placeholder?: string
  error?: string
  initialLabel?: string
}

// Branches are a small, tenant-scoped list (physical locations, not paginated
// server-side), so this searches client-side over the full fetched list
// rather than hitting the API per keystroke — same pattern as
// inventory/purchase-requests' BranchSearchCombobox, just wired to POS's own
// getBranches action instead of duplicating a fetch.
export function BranchSearchCombobox({ value, onChange, placeholder, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      initialLabel={initialLabel}
      queryKey="pos-branches-search"
      placeholder={placeholder ?? 'Search branch by name…'}
      typeToSearchMessage="Type to search branches…"
      emptyMessage="No branches found"
      search={async (query) => {
        const res = await getBranches()
        const branches = res.data ?? []
        const q = query.trim().toLowerCase()
        const matches = q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches
        return matches.map((b) => ({ id: b.id, primary: b.name }))
      }}
    />
  )
}
