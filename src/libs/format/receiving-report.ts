/**
 * The purchase order a receiving report came from.
 *
 * Two sources, in priority order. A receipt entered through "Receive
 * Against PO" carries a real FK per line, so the linked PO's own `code` is
 * authoritative. A receipt entered through the standalone Receive Stock
 * form has no PO link at all — the DR is what's required at receiving, not
 * the SI or the PO — and the clerk types the number into the free-text
 * `purchaseOrderNumber` header field instead.
 *
 * Lives here rather than inline because three surfaces need to agree on
 * it: the reports list, the printed RR, and the on-screen sheet that
 * deliberately re-implements that print markup as React. Those last two
 * have drifted from each other before.
 *
 * Structurally typed so both the typed `ReceivingReport` and the loosely
 * shaped print envelope can pass their record in unchanged.
 */
export function receivingReportPoCode(
  report:
    | {
        purchaseOrderNumber?: string | null
        lines?: { purchaseOrderLine?: { purchaseOrder?: { code?: string | null } | null } | null }[]
      }
    | null
    | undefined
): string | null {
  if (!report) return null
  for (const line of report.lines ?? []) {
    const code = line.purchaseOrderLine?.purchaseOrder?.code
    if (code) return code
  }
  return report.purchaseOrderNumber?.trim() || null
}
