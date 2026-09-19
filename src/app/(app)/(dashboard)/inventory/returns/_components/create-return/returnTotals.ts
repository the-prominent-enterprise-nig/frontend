import { DISPOSITION_META, type CustomerReturnFormValues } from '@/src/schema/inventory/returns'

export type ReturnSettlement = {
  units: number
  lines: number
  /** What goes back to the customer: every line whose disposition credits. */
  refundable: number
  /** Money held against units the customer still owns — repairs. Shown so
   *  nobody reads the refund total as "the value of what came in". */
  notRefunded: number
  /** How many units are being swapped, and how many of those have a
   *  replacement named yet. The second number is what tells the ledger to say
   *  "pending" rather than "even". */
  swaps: number
  swapsPriced: number
  /** Positive: the customer gets money back. Negative: they owe.
   *
   *  Only ever positive today. An exchange is an even swap — same item, same
   *  price — so no swap can leave money owed in either direction, and the
   *  "Customer pays" side of the ledger is reached only if that rule is ever
   *  relaxed to allow settling a price gap. */
  net: number
}

export function computeSettlement(lines: CustomerReturnFormValues['lines']): ReturnSettlement {
  let units = 0
  let refundable = 0
  let notRefunded = 0
  let swaps = 0
  let swapsPriced = 0

  for (const line of lines) {
    const qty = Number.isFinite(line.quantity) ? line.quantity : 0
    const value = (line.unitPrice ?? 0) * qty
    units += qty

    if (line.disposition && DISPOSITION_META[line.disposition].credit) refundable += value
    if (line.disposition === 'repair') notRefunded += value
    if (line.disposition === 'exchange') {
      swaps += qty
      if (line.replacementSerialNumberId) swapsPriced += 1
    }
  }

  return {
    units,
    lines: lines.length,
    refundable,
    notRefunded,
    swaps,
    swapsPriced,
    net: refundable,
  }
}
