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
 * The ticked units, kept when the page changes. A unit shown on the current
 * page uses its fresh row (and drops out if it can no longer be transferred);
 * one ticked on another page keeps the row it had when ticked.
 */
function currentSelection(
  picked: Map<string, SerialNumberSummary>,
  serials: SerialNumberSummary[]
): SerialNumberSummary[] {
  const shown = new Map(serials.map((s) => [s.id, s]))
  return [...picked.values()].flatMap((s) => {
    const fresh = shown.get(s.id)
    if (!fresh) return [s]
    return isTransferable(fresh) ? [fresh] : []
  })
}

/**
 * Ticked serials on the General Stockbook, for "Stock Transfer" and "Consign
 * to Caravan". Ticks carry over across pages, searches and filters, since
 * the units to transfer rarely sit on one page; the header checkbox ticks or
 * unticks only the rows currently shown. Clear empties the whole selection.
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
  const [picked, setPicked] = useState<Map<string, SerialNumberSummary>>(new Map())
  const selectable = serials.filter(isTransferable)
  const selected = currentSelection(picked, serials)
  const selectedIds = new Set(selected.map((s) => s.id))
  const sourceIds = new Set(selected.map((s) => sourceOf(s)?.id))
  const allSelected = selectable.length > 0 && selectable.every((s) => selectedIds.has(s.id))

  const toggle = (id: string): void =>
    setPicked((prev) => {
      const next = new Map(prev)
      const serial = serials.find((s) => s.id === id)
      if (next.has(id)) next.delete(id)
      else if (serial) next.set(id, serial)
      return next
    })

  const toggleAll = (): void =>
    setPicked((prev) => {
      const next = new Map(prev)
      selectable.forEach((s) => (allSelected ? next.delete(s.id) : next.set(s.id, s)))
      return next
    })

  return {
    selected,
    isSelected: (id) => selectedIds.has(id),
    toggle,
    toggleAll,
    allSelected,
    clear: () => setPicked(new Map()),
    sourceWarehouse: selected[0] ? sourceOf(selected[0]) : null,
    mixedSources: sourceIds.size > 1,
    // A caravan sells what it carries, so a unit in repair can't go on one.
    hasRepairUnits: selected.some((s) => !isConsignable(s)),
  }
}
