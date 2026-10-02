'use client'

import { useState } from 'react'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

/** Only an on-hand unit no open transfer already claims can be consigned. */
export function isConsignable(serial: SerialNumberSummary): boolean {
  return serial.status === 'in_stock' && !serial.openTransfer
}

/** Where the unit physically sits — the transfer's source. */
function sourceOf(serial: SerialNumberSummary): SerialNumberSummary['warehouse'] {
  return serial.currentWarehouse ?? serial.warehouse
}

/**
 * Ticked serials on the All Serials list, for "Consign to Caravan". Only
 * ticks on the rows currently shown count, so a tick can never carry over
 * silently to another page or filter.
 */
export function useSerialSelection(serials: SerialNumberSummary[]): {
  selected: SerialNumberSummary[]
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: () => void
  allSelected: boolean
  clear: () => void
  sourceWarehouse: SerialNumberSummary['warehouse']
  mixedSources: boolean
} {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const selectable = serials.filter(isConsignable)
  const selected = selectable.filter((s) => ids.has(s.id))
  const sourceIds = new Set(selected.map((s) => sourceOf(s)?.id))
  const allSelected = selectable.length > 0 && selected.length === selectable.length

  const toggle = (id: string): void =>
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return {
    selected,
    isSelected: (id) => ids.has(id),
    toggle,
    toggleAll: () => setIds(allSelected ? new Set() : new Set(selectable.map((s) => s.id))),
    allSelected,
    clear: () => setIds(new Set()),
    sourceWarehouse: selected[0] ? sourceOf(selected[0]) : null,
    mixedSources: sourceIds.size > 1,
  }
}
