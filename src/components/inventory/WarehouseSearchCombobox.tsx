'use client'

import { useQueryClient } from '@tanstack/react-query'
import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'

// allBranches keeps a branch-scoped requester from being narrowed to their
// own branch — honored server-side only for callers who can raise a
// transfer/PR/PO (see warehouses.controller.ts), ignored for everyone else.
const WAREHOUSE_LOOKUP_KEY = ['inventory-warehouses-lookup', 'all-branches']
const WAREHOUSE_LOOKUP_PARAMS = { limit: 200, status: 'active', allBranches: true } as const

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  initialLabel?: string
}

/** Location picker for purchase requests/orders — every active location,
 * the standalone warehouses and each branch's own stock location alike.
 * The list is fetched once (shared cache, 5 min) and filtered in the
 * browser rather than re-queried per keystroke: a branch's location shows
 * as its branch name, which the API's own `search` doesn't match — that
 * only looks at the warehouse's own name and code. */
export function WarehouseSearchCombobox({ value, onChange, error, initialLabel }: Props) {
  const queryClient = useQueryClient()

  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      initialLabel={initialLabel}
      // Its own namespace, not 'inventory-warehouses-lookup': SearchCombobox
      // keys its internal cache as [queryKey, typedText], so sharing that
      // prefix would let someone typing "standalone" collide with the
      // ['inventory-warehouses-lookup', 'standalone'] entry other screens
      // keep — a cached warehouse *response*, not an option list.
      queryKey="warehouse-locations-search"
      placeholder="Search location by branch or code…"
      typeToSearchMessage="Type to search locations…"
      emptyMessage="No locations found"
      search={async (query) => {
        const res = await queryClient.fetchQuery({
          queryKey: WAREHOUSE_LOOKUP_KEY,
          queryFn: () => getWarehouses(WAREHOUSE_LOOKUP_PARAMS),
          staleTime: 5 * 60 * 1000,
        })
        const q = query.trim().toLowerCase()
        return (res.data?.data ?? [])
          .map((wh) => ({
            // Each branch has exactly one warehouse, named "{branch}
            // Warehouse" — show the branch itself, as every other location
            // picker does.
            id: wh.id,
            primary: wh.branch?.name ?? wh.name,
            secondary: wh.code,
          }))
          .filter((o) => !q || `${o.primary} ${o.secondary}`.toLowerCase().includes(q))
      }}
    />
  )
}
