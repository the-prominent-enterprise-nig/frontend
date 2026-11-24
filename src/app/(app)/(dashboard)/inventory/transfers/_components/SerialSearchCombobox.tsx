'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

type Props = {
  value: string
  onChange: (id: string) => void
  /** Fires alongside onChange with the full picked option — for callers
   * that need the serial's display label too, not just its id. */
  onSelect?: (option: SearchComboboxOption) => void
  /** Asks the server for the serials matching what was typed ('' = the first
   * few). Not a list handed in and filtered here: an item can have hundreds of
   * units, and filtering the first page in the browser never reached the rest
   * (Docket #94). */
  search: (query: string) => Promise<SerialNumberSummary[]>
  queryKey: string
  disabled?: boolean
  placeholder?: string
  error?: string
  /** The picked serial's label when `value` arrives prefilled (an edit). */
  initialLabel?: string
}

// The caller scopes the search to the chosen item (and status/warehouse); the
// typed text goes to the server with it.
export function SerialSearchCombobox({
  value,
  onChange,
  onSelect,
  search: fetchSerials,
  queryKey,
  disabled,
  placeholder,
  error,
  initialLabel,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      disabled={disabled}
      initialLabel={initialLabel}
      queryKey={queryKey}
      // SearchCombobox shows `placeholder` (not `typeToSearchMessage`) on the
      // input itself whenever nothing is confirmed yet — including while
      // disabled — so the caller's state-dependent message needs to be
      // passed here, not as typeToSearchMessage (which only ever appears
      // inside the open dropdown, which `disabled` prevents opening at all).
      placeholder={placeholder ?? 'Search serial number…'}
      typeToSearchMessage="Type to search serial numbers…"
      emptyMessage="No matching serial numbers"
      search={async (query) => {
        const matches = await fetchSerials(query.trim())
        // Scenario 29 SN-01 — an override-capable picker's `options` isn't
        // pre-scoped to "valid at this warehouse" anymore, so surfacing
        // where each serial actually is lets a supervisor tell apart the
        // physically-correct-but-stale one from an unrelated unit.
        return matches.map((s) => ({
          id: s.id,
          primary: s.serialNumber,
          secondary: [s.currentWarehouse?.name, s.status].filter(Boolean).join(' · ') || undefined,
        }))
      }}
    />
  )
}
