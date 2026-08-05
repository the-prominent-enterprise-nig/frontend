'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getAvailableSerialNumbers } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'

type Props = {
  itemId: string
  branchId?: string
  value: string
  onChange: (id: string) => void
  onSelectSerial?: (serialNumber: string) => void
  error?: string
  initialLabel?: string
}

// Estimate-time serial pick for a serial-tracked material line — same
// branch-scoped in_stock lookup POS checkout's serial picker uses
// (getAvailableSerialNumbers), just surfaced as a plain search field since a
// service draft line only ever needs one unit (estimatedQty locked to 1),
// not the checkout picker's primary/secondary-stage, cross-branch overlay.
export function SerialNumberSearchCombobox({
  itemId,
  branchId,
  value,
  onChange,
  onSelectSerial,
  error,
  initialLabel,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={(option) => onSelectSerial?.(option.primary)}
      error={error}
      initialLabel={initialLabel}
      queryKey={`service-draft-serial-search-${itemId}`}
      placeholder="Search serial number…"
      typeToSearchMessage="Type to search serial numbers…"
      emptyMessage="No available serial numbers"
      search={async (query) => {
        const res = await getAvailableSerialNumbers(itemId, branchId)
        const rows = res.data ?? []
        const filtered = query
          ? rows.filter((sn) => sn.serialNumber.toLowerCase().includes(query.toLowerCase()))
          : rows
        return filtered.map((sn) => ({ id: sn.id, primary: sn.serialNumber }))
      }}
    />
  )
}
