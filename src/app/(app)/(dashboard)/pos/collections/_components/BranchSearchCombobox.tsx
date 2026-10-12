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
//
// Scenario 60 — caravans are dropped from the list, unlike the POS pickers
// that share getBranches(). A caravan keeps no books of its own: a collection
// taken at one belongs to the branch hosting it, whose drawer and Daily
// Collection Report account for the cash (the backend folds a caravan onto
// its host either way, so picking one would silently file the receipt
// elsewhere than the name shown here).
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
        const branches = (res.data ?? []).filter((b) => !b.isTemporary)
        const q = query.trim().toLowerCase()
        const matches = q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches
        return matches.map((b) => ({ id: b.id, primary: b.name }))
      }}
    />
  )
}
