'use client'

import type { ReactElement } from 'react'
import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import {
  SERIAL_STATUS_LABELS,
  type SerialNumberSummary,
} from '@/src/schema/inventory/serial-numbers'

type Props = {
  /** Serials already on the sheet, so a unit can't be added twice. */
  usedSerialIds: ReadonlySet<string>
  onPick: (serial: SerialNumberSummary) => void
}

/** Where the system last had the unit, so the counter can see why it's "found". */
function whereabouts(s: SerialNumberSummary): string {
  const place = s.currentWarehouse?.name ?? s.warehouse?.name ?? 'no location'
  return `${SERIAL_STATUS_LABELS[s.status] ?? s.status} · ${place}`
}

function toOption(s: SerialNumberSummary): SearchComboboxOption {
  const model = [s.item?.brand?.name, s.item?.modelNumber].filter(Boolean).join(' ')
  return {
    id: s.id,
    primary: s.serialNumber,
    secondary: `${model || s.item?.name || ''} — ${whereabouts(s)}`,
    meta: s,
  }
}

/**
 * Add Found Item (Scenario 87): a unit the count's snapshot didn't list,
 * searched by serial across every location the user can see — the unit is
 * "found" precisely because the system has it somewhere else (or nowhere).
 */
export default function FoundUnitPicker({ usedSerialIds, onPick }: Props): ReactElement {
  const search = async (query: string): Promise<SearchComboboxOption[]> => {
    const res = await getSerialNumbers({ search: query, limit: 20 })
    const serials = res.success ? (res.data?.data ?? []) : []
    return serials.filter((s) => !usedSerialIds.has(s.id)).map(toOption)
  }

  return (
    <SearchCombobox
      value=""
      onChange={() => undefined}
      onSelect={(option) => onPick(option.meta as SerialNumberSummary)}
      queryKey="count-found-unit"
      search={search}
      placeholder="Search the serial number…"
      typeToSearchMessage="Type a serial number to search"
      emptyMessage="No unit with that serial — register it under Serial Numbers first."
      compact
      clearable={false}
    />
  )
}
