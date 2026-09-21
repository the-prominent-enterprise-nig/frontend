'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Pencil, Printer } from 'lucide-react'
import ReceivingReportSheet, {
  type ReceivingReportDocument,
} from '../../../../accounting/receiving-reports/_components/ReceivingReportSheet'
import ReceivingReportEditForm from '../../../../accounting/receiving-reports/_components/ReceivingReportEditForm'
import { printReceivingReportDocument } from '@/src/libs/print/printInventoryDocument'
import { getReceivingDocument } from '../../_actions/get-receiving-document'
import { getReceivingReport } from '../../_actions/get-receiving-report'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'
import { discountChainLabel } from '@/src/libs/format/discount-chain'

function fmtPHP(n: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

/** MM/DD/YYYY, the format used across these screens. */
function fmtDate(v?: string | null): string {
  return v
    ? new Date(v).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      })
    : '—'
}

export default function ReceivingReportDetail({
  id,
  // Receiving reports live under the Stock hub's own Reports tab.
  backHref = '/inventory/stock?tab=reports',
  backLabel = 'Back',
}: {
  id: string
  /** Both Inventory and Accounting show receiving reports; the back link has
   * to return to whichever list the reader actually came from. */
  backHref?: string
  backLabel?: string
}) {
  const [doc, setDoc] = useState<ReceivingReportDocument | null>(null)
  const [record, setRecord] = useState<ReceivingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Scenario 46 — a receiving report is correctable after the fact. The case it
  // exists for is the supplier invoice number, which routinely arrives days
  // after the goods; the rest follows so a correction doesn't need two screens.
  // Quantity and unit cost are deliberately absent — those moved physical stock
  // and wrote cost layers when the receipt posted.
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    // Two fetches on purpose. The document is the paper — what prints, and what
    // the sheet below renders faithfully. The record carries what the paper
    // deliberately doesn't: ordered quantities, variances, QC holds, batch
    // numbers. Same split APBillDetail uses, so the sheet never drifts from the
    // printout to accommodate screen-only data.
    Promise.all([getReceivingDocument(id), getReceivingReport(id)]).then(([docRes, recRes]) => {
      if (docRes.success && docRes.data) {
        setDoc(docRes.data as ReceivingReportDocument)
      } else {
        setError(docRes.error ?? 'Receiving report not found')
      }
      if (recRes.success && recRes.data) setRecord(recRes.data)
      setLoading(false)
    })
  }, [id])

  const refetchAfterSave = () => {
    setEditing(false)
    // Re-fetch both: the sheet renders the document, which the edit changed too.
    Promise.all([getReceivingDocument(id), getReceivingReport(id)]).then(([docRes, recRes]) => {
      if (docRes.success && docRes.data) setDoc(docRes.data as ReceivingReportDocument)
      if (recRes.success && recRes.data) setRecord(recRes.data)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading receiving report…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const lines = record?.lines ?? []
  // Only worth a table of its own when the paper genuinely omits something.
  const hasRecordOnly = lines.some(
    (l) =>
      l.discrepancy != null ||
      l.qualityHold ||
      !!l.batchNumber ||
      !!l.notes ||
      l.purchaseOrderLine != null
  )

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <div className="flex items-center gap-2">
          {!editing && record && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-purple-700 hover:bg-purple-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
          <button
            onClick={() => printReceivingReportDocument(doc)}
            className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* Record data the paper doesn't carry — kept above the sheet so the
          sheet itself stays a faithful preview of what prints. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
        {record?.hasAnyDiscrepancy ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Variance
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            OK
          </span>
        )}
        {record?.journalEntryId && (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
            GL posted
          </span>
        )}
        {record?.receivedByName && <span>Received by {record.receivedByName}</span>}
        {record?.poDate && <span>PO dated {fmtDate(record.poDate)}</span>}
        {record?.withholding === 'pct_1' && (
          <span>Withholding 1% · {record.withheldAmount ?? 0}</span>
        )}
      </div>

      {/* Scenario 46 — correcting the report after the fact. Shared with the
          PO's Delivery Receipts drawer so a correction reads the same way
          from either screen. */}
      {editing && record && (
        <ReceivingReportEditForm
          id={id}
          record={record}
          onCancel={() => setEditing(false)}
          onSaved={refetchAfterSave}
        />
      )}

      <div className="mt-2.5">
        <ReceivingReportSheet doc={doc} />
      </div>

      {/* Pricing as received — the discount chain the receipt itself carries,
          which is the one that priced the stock. It can differ from the PO's:
          receiving is where a supplier's actual invoice terms get corrected. */}
      {!editing && lines.length > 0 && (
        <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-prominent-purple-900">Pricing</h2>
          <p className="mb-3 text-[12px] text-gray-500">
            What was agreed on arrival. The printed report states the unit cost only.
          </p>
          {/* Shown even when every cell is blank. Receipts taken before the
              pricing fields were carried through (a zod schema was silently
              dropping them on the way to the server) have nothing to display,
              and those are deliberately left blank rather than backfilled from
              the PO — the PO states what was ordered, not what arrived. An
              empty column still says the field exists and where it will
              appear; a hidden section says the feature isn't there. */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-[13px]">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">SRP &amp; discounts</th>
                  <th className="py-2 pr-4 text-right">Unit cost</th>
                  <th className="py-2 pr-4">Tax code</th>
                  <th className="py-2 text-right">Tax amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => {
                  const chain = discountChainLabel(l, fmtPHP)
                  return (
                    <tr key={l.id}>
                      <td className="py-2 pr-4 text-gray-900">
                        {l.item?.name ?? l.itemId}
                        {l.item?.sku && (
                          <span className="ml-1 font-mono text-[11px] text-gray-400">
                            {l.item.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {chain || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {l.unitCost != null ? fmtPHP(Number(l.unitCost)) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{l.taxCode || '—'}</td>
                      <td className="py-2 text-right tabular-nums">
                        {l.taxAmount != null ? fmtPHP(Number(l.taxAmount)) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* The receiving check itself: what was ordered against what turned up,
          and the condition it turned up in. None of this appears on the printed
          report, which states only what was received. */}
      {hasRecordOnly && (
        <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-prominent-purple-900">
            Receiving check
          </h2>
          <p className="mb-3 text-[12px] text-gray-500">
            Ordered against received, and the condition on arrival — recorded here, not on the
            printed report.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-[13px]">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4 text-right">Ordered</th>
                  <th className="py-2 pr-4 text-right">This delivery</th>
                  <th className="py-2 pr-4 text-right">Received to date</th>
                  <th className="py-2 pr-4 text-right">Outstanding</th>
                  <th className="py-2 pr-4">Condition</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => {
                  // Scenario 56 — judged across every delivery on the PO line,
                  // so a correct partial delivery reads "2 outstanding", not a
                  // shortfall of −2 against the whole order.
                  const ordered = l.purchaseOrderLine?.quantity ?? null
                  const toDate =
                    ordered != null
                      ? (l.discrepancy?.qtyReceivedToDate ?? Number(l.quantityReceived))
                      : null
                  const outstanding =
                    ordered != null && toDate != null ? Number(ordered) - toDate : null
                  return (
                    <tr key={l.id}>
                      <td className="py-2 pr-4 text-gray-900">
                        {l.item?.name ?? l.itemId}
                        {l.item?.sku && (
                          <span className="ml-1 font-mono text-[11px] text-gray-400">
                            {l.item.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{ordered ?? '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{l.quantityReceived}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                        {toDate ?? '—'}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right tabular-nums ${
                          outstanding != null && outstanding < 0
                            ? 'font-semibold text-red-600'
                            : outstanding
                              ? 'font-semibold text-amber-600'
                              : 'text-gray-500'
                        }`}
                      >
                        {outstanding == null
                          ? '—'
                          : outstanding < 0
                            ? `+${-outstanding} over`
                            : outstanding === 0
                              ? 'None'
                              : outstanding}
                      </td>
                      <td className="py-2 pr-4">
                        {l.qualityHold ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            QC hold
                          </span>
                        ) : (
                          <span className="text-emerald-700">OK</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{l.batchNumber || '—'}</td>
                      <td className="py-2 text-gray-600">{l.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
