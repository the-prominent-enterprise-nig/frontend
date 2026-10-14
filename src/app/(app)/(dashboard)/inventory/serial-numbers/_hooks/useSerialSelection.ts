'use client'

import { useState } from 'react'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

/** Only an on-hand unit no open transfer already claims can be consigned. */
export function isConsignable(serial: SerialNumberSummary): boolean {
  return serial.status === 'in_stock' && !serial.openTransfer
}

/**
 * Scenario 72 Part 9 — a Stock Transfer may also carry our own units in
 * repair (to main for assessment, say); they land in repair, not as stock.
 * A customer's unit in repair is refused by the server, which knows whose it is.
 */
export function isTransferable(serial: SerialNumberSummary): boolean {
  return (serial.status === 'in_stock' || serial.status === 'in_repair') && !serial.openTransfer
}

/** Where the unit physically sits — the transfer's source. */
function sourceOf(serial: SerialNumberSummary): SerialNumberSummary['warehouse'] {
  return serial.currentWarehouse ?? serial.warehouse
}

/**
 * Ticked serials on the All Serials list, for "Stock Transfer" and "Consign
 * to Caravan". Only
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
  hasRepairUnits: boolean
} {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const selectable = serials.filter(isTransferable)
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
    // A caravan sells what it carries, so a unit in repair can't go on one.
    hasRepairUnits: selected.some((s) => !isConsignable(s)),
  }
}
