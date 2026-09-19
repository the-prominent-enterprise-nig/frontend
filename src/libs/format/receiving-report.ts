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

/**
 * The source document a receiving report points back at, as the printed
 * sheet's third meta slot states it.
 *
 * That slot has always been labelled "P.O. No.", which is right for the two
 * supplier routes (Receive Against PO, or a typed-in number) but wrong for
 * the third: stock arriving from another branch has no purchase order at
 * all. Those receipts printed an empty "P.O. No." while the number that
 * actually identifies the delivery — the transfer it came on — appeared
 * nowhere on the paper.
 *
 * So the slot is labelled by what the receipt is, rather than assumed to be
 * a PO. The `dated` half is the same swap: a supplier receipt pairs the PO
 * with `poDate`, a transfer receipt pairs the transfer with the date it was
 * dispatched.
 *
 * Returns the label even when there is no reference to put in it, so the
 * sheet keeps its fixed four-slot shape and callers render their own blank.
 *
 * Structurally typed for the same reason receivingReportPoCode() is: the
 * typed record and the loose print envelope both pass through unchanged.
 */
export function receivingReportSourceRef(
  report:
    | (Parameters<typeof receivingReportPoCode>[0] & {
        poDate?: string | Date | null
        stockTransfer?: {
          transferNumber?: string | null
          transferDate?: string | Date | null
        } | null
      })
    | null
    | undefined
): { label: string; code: string | null; dated: string | Date | null } {
  const transfer = report?.stockTransfer
  if (transfer) {
    return {
      label: 'Transfer No.',
      code: transfer.transferNumber?.trim() || null,
      dated: transfer.transferDate ?? null,
    }
  }
  return {
    label: 'P.O. No.',
    code: receivingReportPoCode(report),
    dated: report?.poDate ?? null,
  }
}

/**
 * Who the receipt's counterparty is, as the sheet's party block and the
 * reports list both name it.
 *
 * A supplier receipt names the supplier. A transfer-sourced receipt has no
 * supplier at all — the stock came from another branch — so it names the
 * branch that sent it. Those rows used to read a bare "—", which said
 * nothing about where a delivery had actually come from.
 *
 * Branch name in preference to the warehouse's own: every branch's warehouse
 * is named "<Branch> Warehouse", so the branch is the name staff actually use
 * for the place. Falls back to the warehouse name where a location has no
 * branch (the standalone warehouses do not).
 *
 * Returns null when there is nothing to name, so callers render their own
 * placeholder rather than this inventing one.
 */
export function receivingReportSourceName(
  report:
    | {
        supplier?: { name?: string | null } | null
        stockTransfer?: {
          fromWarehouse?: {
            name?: string | null
            branch?: { name?: string | null } | null
          } | null
        } | null
      }
    | null
    | undefined
): string | null {
  const supplier = report?.supplier?.name?.trim()
  if (supplier) return supplier
  const from = report?.stockTransfer?.fromWarehouse
  if (!from) return null
  return from.branch?.name?.trim() || from.name?.trim() || null
}
