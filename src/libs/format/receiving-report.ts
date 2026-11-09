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
 * sheet's fourth and fifth meta slots state it.
 *
 * That slot used to be labelled "P.O. No." regardless, which is right for
 * the two supplier routes (Receive Against PO, or a typed-in number) but
 * wrong for the third: stock arriving from another branch has no purchase
 * order at all. Those receipts printed an empty "P.O. No." while the number
 * that actually identifies the delivery — the transfer it came on — appeared
 * nowhere on the paper.
 *
 * So the slot is labelled by what the receipt is, rather than assumed to be
 * a PO, and its date slot follows it: "PO Date" beside "PO No.", "Transfer
 * Date" beside "Transfer No." (Scenario 69 items 2 and 5 — the client wants
 * every label spelled out).
 *
 * The PO date is the typed `poDate` where the clerk entered one off the
 * supplier's paper, otherwise the linked PO's own `orderDate`. A receipt
 * made through Receive Against PO never sets `poDate`, so without the
 * fallback its PO Date always printed blank (Scenario 69 item 1).
 *
 * Returns the labels even when there is no reference to put in them, so the
 * sheet keeps its fixed shape and callers render their own blank.
 *
 * Structurally typed for the same reason receivingReportPoCode() is: the
 * typed record and the loose print envelope both pass through unchanged.
 */
export function receivingReportSourceRef(
  report:
    | (Parameters<typeof receivingReportPoCode>[0] & {
        poDate?: string | Date | null
        lines?: {
          purchaseOrderLine?: {
            purchaseOrder?: { code?: string | null; orderDate?: string | Date | null } | null
          } | null
        }[]
        stockTransfer?: {
          transferNumber?: string | null
          transferDate?: string | Date | null
        } | null
      })
    | null
    | undefined
): { label: string; code: string | null; datedLabel: string; dated: string | Date | null } {
  const transfer = report?.stockTransfer
  if (transfer) {
    return {
      label: 'Transfer No.',
      code: transfer.transferNumber?.trim() || null,
      datedLabel: 'Transfer Date',
      dated: transfer.transferDate ?? null,
    }
  }
  return {
    label: 'PO No.',
    code: receivingReportPoCode(report),
    datedLabel: 'PO Date',
    dated: report?.poDate ?? linkedPoOrderDate(report),
  }
}

/** The order date of the PO a receipt's lines were received against. */
function linkedPoOrderDate(
  report: Parameters<typeof receivingReportSourceRef>[0]
): string | Date | null {
  for (const line of report?.lines ?? []) {
    const date = line.purchaseOrderLine?.purchaseOrder?.orderDate
    if (date) return date
  }
  return null
}

/** One label/value pair in the sheet's meta column. */
export interface ReceivingReportMetaSlot {
  label: string
  value: string | null
  /** A date the caller formats its own way; a plain string otherwise. */
  isDate?: boolean
}

/**
 * The meta column after RR No. and RR Date, in print order — shared so the
 * printed RR and the on-screen sheet cannot drift apart again.
 *
 * A supplier receipt: Reference (their DR, or the SI when no DR was given),
 * then the PO and its date. A transfer receipt: just the transfer and its
 * date — there is no supplier paperwork to reference. A customer return has
 * no supplier paperwork or PO — it points back at the sales invoice the unit
 * was sold on — so it gets Invoice No. and Invoice Date instead, and nothing
 * at all when the receipt was posted before that invoice was saved.
 */
export function receivingReportMetaSlots(
  report:
    | (Parameters<typeof receivingReportSourceRef>[0] & {
        reason?: string | null
        deliveryReceiptNumber?: string | null
        supplierInvoiceNumber?: string | null
        returnedInvoices?: { number: string; date?: string | null }[] | null
      })
    | null
    | undefined
): ReceivingReportMetaSlot[] {
  if (report?.reason === 'repair_return' || report?.reason === 'repossession') {
    const invoices = report.returnedInvoices ?? []
    if (!invoices.length) return []
    return [
      { label: 'Invoice No.', value: invoices.map((i) => i.number).join(', ') },
      { label: 'Invoice Date', value: invoices[0].date ?? null, isDate: true },
    ]
  }
  const source = receivingReportSourceRef(report)
  const dated = source.dated instanceof Date ? source.dated.toISOString() : source.dated
  const sourceSlots: ReceivingReportMetaSlot[] = [
    { label: source.label, value: source.code },
    { label: source.datedLabel, value: dated, isDate: true },
  ]
  // A transfer receipt has no supplier DR or SI to point at, so a Reference
  // slot would only ever print "—".
  if (report?.stockTransfer) return sourceSlots
  const reference = report?.deliveryReceiptNumber || report?.supplierInvoiceNumber || null
  return [{ label: 'Reference', value: reference }, ...sourceSlots]
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

/**
 * The branch that received the delivery, with its street address — printed
 * on its own line above the item table (Scenario 69 item 7), not under the
 * supplier, where it read as the supplier's branch.
 *
 * Branch name in preference to the warehouse's own, as everywhere else on
 * the RR. `addressLine1` alone: the stored street address already carries
 * the city, so adding `city` would repeat it. Null when there is nothing to
 * name.
 */
export function receivingReportBranchLine(
  report:
    | {
        warehouse?: {
          name?: string | null
          branch?: { name?: string | null; addressLine1?: string | null } | null
        } | null
      }
    | null
    | undefined
): { name: string; address: string | null } | null {
  const warehouse = report?.warehouse
  const name = warehouse?.branch?.name || warehouse?.name
  if (!name) return null
  return { name, address: warehouse?.branch?.addressLine1?.trim() || null }
}

/**
 * Per-unit cost as the supplier priced it — VAT included — for the printed
 * and on-screen RR, so its unit cost matches the PO's unit price.
 *
 * Receiving stores each line net of the VAT it backs out (that is what the
 * stock and the GL are carried at), and the receipt does not record its own
 * VatTreatment. The gross is recovered the way ReceivingReportEditForm
 * already does it: net share = Σ net ÷ (Σ net + the receipt's VAT). Lines
 * are stored to 4 decimals, so rounding the recovered figure to centavos
 * lands back on the price that was typed.
 *
 * Returns null per line where the line carries no cost at all.
 */
/**
 * The receipt with only the lines that actually arrived. A transfer receipt
 * also records every outstanding line it resolved at 0 (the backend's audit
 * trail of what this batch closed out, serial included) — but a receiving
 * report lists what was received, so those never print. Applied before the
 * index-aligned helpers above, so the sheet and the printout agree.
 */
export function receivingReportReceivedOnly<T extends { lines?: unknown }>(report: T): T {
  if (!Array.isArray(report.lines)) return report
  const lines = (report.lines as { quantityReceived?: unknown }[]).filter(
    (l) => Number(l.quantityReceived ?? 0) > 0
  )
  return { ...report, lines }
}

export function receivingReportGrossUnitCosts(report: {
  vatAmount?: number | string | null
  lines?: { quantityReceived?: number | string | null; unitCost?: number | string | null }[] | null
}): (number | null)[] {
  const lines = report.lines ?? []
  const netTotal = lines.reduce(
    (sum, l) => sum + Number(l.quantityReceived ?? 0) * Number(l.unitCost ?? 0),
    0
  )
  const vat = Number(report.vatAmount ?? 0)
  const netShare = netTotal > 0 && vat > 0 ? netTotal / (netTotal + vat) : 1
  return lines.map((l) =>
    l.unitCost == null ? null : Math.round((Number(l.unitCost) / netShare) * 100) / 100
  )
}

/** A receiving-report line as the row-grouping below reads it. */
type GroupableLine = {
  quantityReceived?: unknown
  serialNumbers?: string[] | null
  item?: {
    name?: string | null
    modelNumber?: string | null
    brand?: { name?: string | null } | null
    primaryCategory?: { name?: string | null } | null
  } | null
}

/** One printed row: every received line with the same Brand, Subgroup,
 * Model and unit cost, quantities summed and serials listed together. */
export interface ReceivingReportRow {
  key: string
  brand: string
  subgroup: string
  model: string
  quantity: number
  serials: string[]
  unitCost: number | null
}

/**
 * The item table's rows, shared by the on-screen sheet and the printout. A
 * transfer RR carries one line per serial, so five units of one model would
 * read as five identical rows; they collapse into one. Lines whose unit
 * cost differs stay apart, so Qty × Unit cost still equals Amount.
 * `grossUnitCosts` is index-aligned with `lines`.
 *
 * Serials print as they now stand — a receipt-time correction (wrong serial
 * or wrong unit) is the transfer's history, shown on the transfer, not here.
 */
export function receivingReportRows(
  lines: GroupableLine[],
  grossUnitCosts: (number | null)[]
): ReceivingReportRow[] {
  const rows = new Map<string, ReceivingReportRow>()
  lines.forEach((line, i) => {
    const row = rowFor(rows, line, grossUnitCosts[i] ?? null)
    row.quantity += Number(line.quantityReceived ?? 0)
    row.serials.push(...(line.serialNumbers ?? []))
  })
  return [...rows.values()]
}

function rowFor(
  rows: Map<string, ReceivingReportRow>,
  line: GroupableLine,
  unitCost: number | null
): ReceivingReportRow {
  const brand = line.item?.brand?.name ?? ''
  const subgroup = line.item?.primaryCategory?.name ?? ''
  const model = line.item?.modelNumber || line.item?.name || ''
  const key = JSON.stringify([brand, subgroup, model, unitCost])
  const existing = rows.get(key)
  if (existing) return existing
  const row = { key, brand, subgroup, model, quantity: 0, serials: [], unitCost }
  rows.set(key, row)
  return row
}
