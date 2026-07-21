'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

type Props = {
  value: string
  onChange: (id: string) => void
  options: SerialNumberSummary[]
  queryKey: string
  disabled?: boolean
  placeholder?: string
  error?: string
}

// Unlike Branch/Item/Supplier combobox siblings, this doesn't fetch its own
// list — the caller already scoped `options` to the chosen item + source
// warehouse (see TransferLineRow's serialsQuery), so this just does a
// client-side substring filter over that already-narrow list.
export function SerialSearchCombobox({
  value,
  onChange,
  options,
  queryKey,
  disabled,
  placeholder,
  error,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
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
        const q = query.trim().toLowerCase()
        const matches = q
          ? options.filter((s) => s.serialNumber.toLowerCase().includes(q))
          : options
        return matches.map((s) => ({ id: s.id, primary: s.serialNumber }))
      }}
    />
  )
}
