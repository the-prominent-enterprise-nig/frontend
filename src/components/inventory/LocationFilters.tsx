'use client'

import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { LocationFilter, Region } from '@/src/libs/inventory/useLocationFilter'

const REGION_OPTIONS = [
  { value: 'panay', label: 'Panay' },
  { value: 'negros', label: 'Negros' },
]

type Chrome = { idle: string; focused: string }

/** Scenario 56 — Operations + multi-select Branches, the same pair on every
 * inventory list. Drive it with useLocationFilter(). */
export function LocationFilters({
  filter,
  chrome,
}: {
  filter: LocationFilter
  chrome?: Chrome
}): React.ReactElement {
  return (
    <>
      {/* Operations — the client's name for region. */}
      <SearchableSelect
        className="w-[168px]"
        value={filter.region ?? ''}
        onChange={(v) => filter.setRegion((v || undefined) as Region | undefined)}
        placeholder="All Operations"
        chrome={chrome}
        clearable
        options={REGION_OPTIONS}
      />
      {/* Branches — across branches and the 2 standalone warehouses. */}
      <SearchableSelect
        multiple
        className="w-[220px]"
        value={filter.locations}
        onChange={filter.setLocations}
        placeholder="All Branches"
        summaryNoun="branches"
        loading={filter.locationsLoading}
        chrome={chrome}
        clearable
        options={filter.locationOptions}
      />
    </>
  )
}
