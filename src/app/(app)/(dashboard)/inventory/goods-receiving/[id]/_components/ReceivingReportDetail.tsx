'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Pencil, X, Printer } from 'lucide-react'
import ReceivingReportSheet, {
  type ReceivingReportDocument,
} from '../../../../accounting/receiving-reports/_components/ReceivingReportSheet'
import { printReceivingReportDocument } from '@/src/libs/print/printInventoryDocument'
import { getReceivingDocument } from '../../_actions/get-receiving-document'
import { getReceivingReport } from '../../_actions/get-receiving-report'
import { updateReceivingReport } from '../../_actions/update-receiving-report'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'
import { discountChainLabel } from '@/src/libs/format/discount-chain'

interface EditLine {
  id: string
  batchNumber: string
  notes: string
  srp: string
  // The whole chain, not just the first link. The Receive modal lets a
  // receipt carry several discounts in order (SRP · 3% · ₱500), and this form
  // used to read discounts[0] and save an array of one — so opening an RR and
  // saving it silently dropped every discount after the first, quietly
  // changing the unit cost the stock was costed at.
  discounts: { value: string; type: 'percentage' | 'amount' }[]
  taxCode: string
  taxAmount: string
}
interface EditState {
  supplierInvoiceNumber: string
  deliveryReceiptNumber: string
  notes: string
  vatAmount: string
  withheldAmount: string
  lines: EditLine[]
}

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
  // There is no /inventory/goods-receiving page — the list lives inside the
  // Operations hub's receiving tab, under its own Receiving Reports sub-tab.
  // Linking to the folder path 404s.
  backHref = '/inventory/operations?tab=receiving&subtab=reports',
  backLabel = 'Back to Goods Receiving',
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
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EditState | null>(null)

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

  const startEdit = () => {
    if (!record) return
    setForm({
      supplierInvoiceNumber: record.supplierInvoiceNumber ?? '',
      deliveryReceiptNumber: record.deliveryReceiptNumber ?? '',
      notes: record.notes ?? '',
      vatAmount: record.vatAmount != null ? String(record.vatAmount) : '',
      withheldAmount: record.withheldAmount != null ? String(record.withheldAmount) : '',
      lines: (record.lines ?? []).map((l) => ({
        id: l.id,
        batchNumber: l.batchNumber ?? '',
        notes: l.notes ?? '',
        srp: l.srp != null ? String(l.srp) : '',
        discounts: (l.discounts ?? []).map((d) => ({
          value: String(d.value),
          type: (d.type ?? 'percentage') as 'percentage' | 'amount',
        })),
        taxCode: l.taxCode ?? '',
        taxAmount: l.taxAmount != null ? String(l.taxAmount) : '',
      })),
    })
    setEditing(true)
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    const res = await updateReceivingReport(id, {
      supplierInvoiceNumber: form.supplierInvoiceNumber || undefined,
      deliveryReceiptNumber: form.deliveryReceiptNumber || undefined,
      notes: form.notes || undefined,
      vatAmount: form.vatAmount === '' ? undefined : Number(form.vatAmount),
      withheldAmount: form.withheldAmount === '' ? undefined : Number(form.withheldAmount),
      lines: form.lines.map((l) => ({
        id: l.id,
        batchNumber: l.batchNumber || undefined,
        notes: l.notes || undefined,
        srp: l.srp === '' ? undefined : Number(l.srp),
        discounts: l.discounts.some((d) => d.value !== '')
          ? l.discounts
              .filter((d) => d.value !== '')
              .map((d) => ({ type: d.type, value: Number(d.value) }))
          : undefined,
        taxCode: l.taxCode || undefined,
        taxAmount: l.taxAmount === '' ? undefined : Number(l.taxAmount),
      })),
    })
    setSaving(false)
    if (!res.success) return alert(res.message || res.error || 'Could not save')
    setEditing(false)
    // Re-fetch both: the sheet renders the document, which the edit changed too.
    const [docRes, recRes] = await Promise.all([getReceivingDocument(id), getReceivingReport(id)])
    if (docRes.success && docRes.data) setDoc(docRes.data as ReceivingReportDocument)
    if (recRes.success && recRes.data) setRecord(recRes.data)
  }

  const setLine = (idx: number, patch: Partial<EditLine>) =>
    setForm((f) =>
      f ? { ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : f
    )

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
          {!editing && (
            <button
              onClick={startEdit}
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

      {/* Scenario 46 — correcting the report after the fact. Laid out like the
          receiving modal so the same paperwork is entered the same way in both
          places: DR / SI / notes across the top, tax beside them, then the
          per-line pricing block.

          Quantity and unit cost are absent, and stay absent: they moved
          physical stock and wrote cost layers when this posted, so a document
          that disagrees with the warehouse would be worse than one that
          disagrees with the books. Editing VAT or withholding here corrects
          THIS REPORT only — the journal entry is not re-posted. */}
      {editing && form && (
        <section className="mt-3 rounded-lg border border-purple-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-prominent-purple-900">
              Correct this receiving report
            </h2>
            <span className="text-[11px] text-amber-700">
              Corrects the document — the posted journal entry is not recalculated
            </span>
          </div>

          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Delivery Receipt No.
              </span>
              <input
                value={form.deliveryReceiptNumber}
                onChange={(e) => setForm({ ...form, deliveryReceiptNumber: e.target.value })}
                placeholder="e.g. DR-00123"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Supplier Invoice No.
              </span>
              <input
                value={form.supplierInvoiceNumber}
                onChange={(e) => setForm({ ...form, supplierInvoiceNumber: e.target.value })}
                placeholder="e.g. SI-00456"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Notes</span>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Delivery notes…"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Input VAT amount</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.vatAmount}
                onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-right text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Withholding tax amount
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.withheldAmount}
                onChange={(e) => setForm({ ...form, withheldAmount: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-right text-sm"
              />
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {form.lines.map((l, idx) => {
              const line = record?.lines?.find((r) => r.id === l.id)
              return (
                <div key={l.id} className="rounded-lg border border-zinc-200 p-3">
                  <p className="mb-2 text-[12px] font-medium text-zinc-800">
                    {line?.item?.name ?? l.id}
                    <span className="ml-2 font-normal text-zinc-400">
                      {line?.quantityReceived} received ·{' '}
                      {line?.unitCost != null ? line.unitCost : '—'} unit cost
                      <span className="ml-1 text-[11px]">(not editable)</span>
                    </span>
                  </p>
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-[12px]">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        SRP
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.srp}
                        onChange={(e) => setLine(idx, { srp: e.target.value })}
                        className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5"
                      />
                    </label>
                    {/* A chain, in the order it applies — the same shape the
                        Receive modal captures, so a receipt taken off a PO with
                        "3% then ₱500" can be corrected here without losing the
                        second step. */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Discounts <span className="normal-case tracking-normal">(off SRP)</span>
                      </span>
                      <div className="flex flex-col gap-1">
                        {l.discounts.map((d, di) => (
                          <div key={di} className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label={`Discount ${di + 1} value`}
                              value={d.value}
                              onChange={(e) =>
                                setLine(idx, {
                                  discounts: l.discounts.map((x, i) =>
                                    i === di ? { ...x, value: e.target.value } : x
                                  ),
                                })
                              }
                              className="w-20 rounded-lg border border-zinc-200 px-2 py-1.5 text-right"
                            />
                            <select
                              aria-label={`Discount ${di + 1} type`}
                              value={d.type}
                              onChange={(e) =>
                                setLine(idx, {
                                  discounts: l.discounts.map((x, i) =>
                                    i === di
                                      ? { ...x, type: e.target.value as 'percentage' | 'amount' }
                                      : x
                                  ),
                                })
                              }
                              className="rounded-lg border border-zinc-200 px-1 py-1.5"
                            >
                              <option value="percentage">%</option>
                              <option value="amount">₱</option>
                            </select>
                            <button
                              type="button"
                              aria-label={`Remove discount ${di + 1}`}
                              onClick={() =>
                                setLine(idx, {
                                  discounts: l.discounts.filter((_, i) => i !== di),
                                })
                              }
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setLine(idx, {
                              discounts: [
                                ...l.discounts,
                                { value: '', type: 'percentage' as const },
                              ],
                            })
                          }
                          className="self-start text-[11px] font-medium text-purple-700 hover:underline"
                        >
                          + Add discount
                        </button>
                      </div>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Tax
                      </span>
                      <div className="flex items-center gap-1">
                        <select
                          value={l.taxCode}
                          onChange={(e) => setLine(idx, { taxCode: e.target.value })}
                          className="rounded-lg border border-zinc-200 px-1 py-1.5"
                        >
                          <option value="">—</option>
                          <option value="VAT">VAT</option>
                          <option value="NON_VAT">Non-VAT</option>
                          <option value="EXEMPT">Exempt</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.taxAmount}
                          onChange={(e) => setLine(idx, { taxAmount: e.target.value })}
                          placeholder="0.00"
                          className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-right"
                        />
                      </div>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Batch No.
                      </span>
                      <input
                        value={l.batchNumber}
                        onChange={(e) => setLine(idx, { batchNumber: e.target.value })}
                        placeholder="Optional"
                        className="w-32 rounded-lg border border-zinc-200 px-2 py-1.5"
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Notes
                      </span>
                      <input
                        value={l.notes}
                        onChange={(e) => setLine(idx, { notes: e.target.value })}
                        placeholder="Optional"
                        className="w-full rounded-lg border border-zinc-200 px-2 py-1.5"
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save corrections'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </section>
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
                  <th className="py-2 pr-4 text-right">Received</th>
                  <th className="py-2 pr-4 text-right">Variance</th>
                  <th className="py-2 pr-4">Condition</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => {
                  const ordered = l.purchaseOrderLine?.quantity ?? null
                  const variance =
                    ordered != null ? Number(l.quantityReceived) - Number(ordered) : null
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
                      <td
                        className={`py-2 pr-4 text-right tabular-nums ${
                          variance ? 'font-semibold text-amber-600' : 'text-gray-500'
                        }`}
                      >
                        {variance == null ? '—' : variance > 0 ? `+${variance}` : variance}
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
