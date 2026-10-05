import { caravanLabel } from '@/src/libs/format/locationLabel'

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
type ReceivingReportSource =
  | {
      supplier?: { name?: string | null } | null
      /** The customer a repair/return or repossession receipt took units back
       * from — such a receipt has no supplier. */
      returnedBy?: { name?: string | null } | null
      stockTransfer?: {
        fromWarehouse?: {
          name?: string | null
          branch?: {
            name?: string | null
            isTemporary?: boolean | null
            eventName?: string | null
            addressLine1?: string | null
          } | null
        } | null
      } | null
    }
  | null
  | undefined

/** A caravan the stock came back from, by where it was set up. */
function caravanSource(report: ReceivingReportSource): { place: string; event: string } | null {
  const branch = report?.supplier?.name?.trim()
    ? null
    : report?.stockTransfer?.fromWarehouse?.branch
  const place = branch?.addressLine1?.trim()
  if (!branch?.isTemporary || !place) return null
  return { place, event: (branch.eventName ?? branch.name ?? '').trim() }
}

export function receivingReportSourceName(report: ReceivingReportSource): string | null {
  const supplier = report?.supplier?.name?.trim()
  if (supplier) return supplier
  const customer = report?.returnedBy?.name?.trim()
  if (customer) return customer
  const from = report?.stockTransfer?.fromWarehouse
  if (!from) return null
  // Scenario 60 — stock coming back from a caravan is named by where the
  // caravan was set up ("Lemery"); the event goes on the line below it.
  const caravan = caravanSource(report)
  if (caravan) return caravan.place
  if (from.branch?.isTemporary && from.branch.name) {
    return caravanLabel({ name: from.branch.name, eventName: from.branch.eventName })
  }
  return from.branch?.name?.trim() || from.name?.trim() || null
}

/** The line under the source name — a caravan's event, when the name above
 * is the place it was set up. Null for every other receipt. */
export function receivingReportSourceSubtitle(report: ReceivingReportSource): string | null {
  return caravanSource(report)?.event || null
}

/** What a no-supplier receipt is for, as the sheet's heading names it. Null
 * for an ordinary supplier or transfer receipt, which needs no label. */
export function receivingReportReasonLabel(
  report: { reason?: string | null; repairType?: string | null } | null | undefined
): string | null {
  if (report?.reason === 'repair_return') {
    const where =
      report.repairType === 'in_store'
        ? ' — In-Store'
        : report.repairType === 'home_service'
          ? ' — Home Service'
          : ''
    return `Repair / Return${where}`
  }
  if (report?.reason === 'repossession') return 'Repossession'
  return null
}
