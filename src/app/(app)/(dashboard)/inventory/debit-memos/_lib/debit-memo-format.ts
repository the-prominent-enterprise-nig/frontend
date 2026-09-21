// How one supplier debit memo reads on the Inventory screens: its status, the
// proof that the goods left, and the arithmetic behind its figures.
//
// These live together because the list, its expanded row and the form all
// describe the same memo — three hand-rolled copies of "how many units is
// this" is how the row and the form it opens end up disagreeing.

import type { SupplierDebitMemo, SupplierDebitMemoStatus } from '@/src/libs/data/AccountingV2Data'
import type { SupplierDebitMemoLineValues } from '@/src/schema/accounting/supplier-debit-memos'

/** Inventory's word for a posted memo is "Approved": the warehouse approves
 * the return, and approving is what posts it. Accounting calls the very same
 * row FINAL — one status, two audiences. Only the label differs; the stored
 * value is always FINAL, which is what the API still exchanges.
 *
 * The enum also carries an APPROVED value, which this lifecycle never reaches
 * (create writes DRAFT, approve writes FINAL). It is folded in here so a row
 * that somehow holds it still paints as posted rather than falling through. */
export type ShownStatus = 'DRAFT' | 'APPROVED' | 'VOID'

export function shownStatus(status: SupplierDebitMemoStatus): ShownStatus {
  return status === 'FINAL' || status === 'APPROVED' ? 'APPROVED' : status
}

export const STATUS_META: Record<
  ShownStatus,
  { label: string; chip: string; dot: string; hint: string }
> = {
  // Draft deliberately reads as "nothing has happened yet" — the colour only
  // warms up once the memo has actually posted.
  DRAFT: {
    label: 'Draft',
    chip: 'bg-[#f1f1f4] text-[#5b5b6b]',
    dot: 'bg-[#a3a3b2]',
    hint: 'Nothing has moved — waiting on an approver',
  },
  APPROVED: {
    label: 'Approved',
    chip: 'bg-[#e7f5ef] text-[#0b6644]',
    dot: 'bg-[#0f7b52]',
    hint: 'Posted — stock out, journal entry posted, invoice reduced',
  },
  VOID: {
    label: 'Void',
    chip: 'bg-[#fdeceb] text-[#b42318]',
    dot: 'bg-[#d9544c]',
    hint: 'Reversed — its posting, stock movement and invoice change are undone',
  },
}

/** Units of stock this memo takes out. Only a line with an item moves stock —
 * a supplier concession or freight recharge is a flat sum against the
 * invoice, so it is counted as a claim instead. */
export function memoUnits(memo: SupplierDebitMemo): number {
  return (memo.lines ?? []).reduce((sum, l) => sum + (l.itemId ? Number(l.quantity) || 0 : 0), 0)
}

/** Lines that move no stock — supplier support, a concession, freight. */
export function memoClaims(memo: SupplierDebitMemo): number {
  return (memo.lines ?? []).filter((l) => !l.itemId).length
}

/** What is going back, in words, for the list's Returning column. */
export function returningLabel(memo: SupplierDebitMemo): string {
  const units = memoUnits(memo)
  if (units === 0) return 'No stock — claim only'
  return `${units.toLocaleString()} ${units === 1 ? 'unit' : 'units'} of stock`
}

/** "3 lines · 1 claim" — what the units figure leaves out. */
export function linesLabel(memo: SupplierDebitMemo): string {
  const lines = memo.lines?.length ?? 0
  const claims = memoClaims(memo)
  const base = `${lines} ${lines === 1 ? 'line' : 'lines'}`
  return claims ? `${base} · ${claims} ${claims === 1 ? 'claim' : 'claims'}` : base
}

/** A line's own figures, read back off the form. The read-only cells and the
 * running total both go through these, so a row can never disagree with the
 * figure under it.
 *
 * Quantity only multiplies a goods line; a concession (no item) is a flat
 * negotiated sum, so its amount stands as typed. Mirrors lineValue() on the
 * server. */
export function lineNet(line: Partial<SupplierDebitMemoLineValues> | undefined): number {
  const unitPrice = Number(line?.unitPrice) || 0
  return line?.itemId ? (Number(line?.quantity) || 0) * unitPrice : unitPrice
}

/** Net plus tax — what the server stores as the line's `lineTotal`. */
export function lineGross(line: Partial<SupplierDebitMemoLineValues> | undefined): number {
  return lineNet(line) + (Number(line?.taxAmount) || 0)
}
