'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getBranches } from '@/src/app/(app)/(dashboard)/inventory/stock-requisitions/_actions/get-branches'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
}

// Branches are a small, tenant-scoped list (physical locations, not paginated
// server-side), so this searches client-side over the full fetched list
// rather than hitting the API per keystroke.
export function BranchSearchCombobox({ value, onChange, error }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      queryKey="branches-search"
      placeholder="Search branch by name…"
      typeToSearchMessage="No specific branch (tenant-wide) — type to search…"
      emptyMessage="No branches found"
      search={async (query) => {
        const res = await getBranches()
        const branches = res.data?.data ?? []
        const q = query.trim().toLowerCase()
        const matches = q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches
        return matches.map((b) => ({ id: b.id, primary: b.name }))
      }}
    />
  )
}
