/**
 * The purchase order a receiving report was received against, as it should
 * be printed on the paper.
 *
 * One shared resolver because the same answer has to read identically on the
 * three surfaces it appears on — the Receiving Reports list column, the
 * on-screen Receiving Report sheet and the printed Receiving Report — and the
 * answer comes from two different places depending on how the receipt was
 * entered:
 *
 *  - Receive Against PO links each line to a PurchaseOrderLine, so the real
 *    PO code lives on `line.purchaseOrderLine.purchaseOrder.code`.
 *  - The standalone Receive Stock form has no PO link at all and instead
 *    carries a free-text `purchaseOrderNumber` the receiver typed in.
 *
 * Linked codes win over the typed one: they are the order the system actually
 * matched against. Returns null when the receipt cites no PO either way (a
 * transfer-sourced receipt, for one) so callers render their own placeholder
 * rather than this inventing one.
 */

export interface PoNumberSource {
  purchaseOrderNumber?: string | null
  lines?:
    | {
        purchaseOrderLine?: { purchaseOrder?: { code?: string | null } | null } | null
      }[]
    | null
}

export function receivingReportPoNumber(receipt: PoNumberSource): string | null {
  // Nothing forces a receipt's lines onto a single PO — the receive payload
  // takes a purchaseOrderLineId per line — so list every distinct order the
  // paper is answering for rather than silently printing only the first.
  const linked = [
    ...new Set(
      (receipt.lines ?? [])
        .map((l) => l.purchaseOrderLine?.purchaseOrder?.code)
        .filter((code): code is string => !!code)
    ),
  ]
  if (linked.length > 0) return linked.join(', ')
  return receipt.purchaseOrderNumber?.trim() || null
}
