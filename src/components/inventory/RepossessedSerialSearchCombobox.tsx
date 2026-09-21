'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getSerialNumbers } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-numbers'

/** Carried through `onSelect`'s `option.meta` so the caller can auto-resolve
 * the InstallmentAccount without a second round trip to re-fetch the serial. */
export type RepossessedSerialMeta = {
  soldToCustomerId?: string | null
}

type Props = {
  itemId: string
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
}

/** Scenario 55 Part 4 — picks the specific already-sold unit being
 * repossessed, scoped to this line's item. Deliberately status: 'sold', not
 * a free-text serial box: a repossessed unit already has a SerialNumber row
 * from its original sale, and typing that same number as "new" would 409
 * against the already-registered check (see existingSerialNumberIds on
 * receiveStock()). */
export function RepossessedSerialSearchCombobox({
  itemId,
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      queryKey={`repossessed-serials-search-${itemId}`}
      placeholder="Search this item's sold units…"
      typeToSearchMessage="Type a serial number to search…"
      emptyMessage="No sold units of this item found"
      search={async (query) => {
        const res = await getSerialNumbers({
          itemId,
          status: 'sold',
          search: query || undefined,
          limit: 20,
        })
        return (res.data?.data ?? []).map((s) => ({
          id: s.id,
          primary: s.serialNumber,
          secondary: s.saleDate ? `Sold ${s.saleDate.slice(0, 10)}` : 'Sold',
          meta: { soldToCustomerId: s.soldToCustomerId } satisfies RepossessedSerialMeta,
        }))
      }}
    />
  )
}
