'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { updateReceivingReport } from '../../../inventory/goods-receiving/_actions/update-receiving-report'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'

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

function initialFormFrom(record: ReceivingReport): EditState {
  return {
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
  }
}

type Props = {
  id: string
  record: ReceivingReport
  onCancel: () => void
  /** Called after a successful save — the caller owns re-fetching the
   * document/record it renders and closing this form back down. */
  onSaved: () => void
}

/**
 * Scenario 46 — correcting a receiving report after the fact. Laid out like
 * the receiving modal so the same paperwork is entered the same way in both
 * places: DR / SI / notes across the top, tax beside them, then the per-line
 * pricing block.
 *
 * Quantity and unit cost are absent, and stay absent: they moved physical
 * stock and wrote cost layers when this posted, so a document that disagrees
 * with the warehouse would be worse than one that disagrees with the books.
 * Editing VAT or withholding here corrects THIS REPORT only — the journal
 * entry is not re-posted.
 *
 * Shared between the Goods Receiving detail screen and the PO's Delivery
 * Receipts drawer, so a correction made from either place is the exact same
 * form rather than two copies that could quietly drift apart.
 */
export default function ReceivingReportEditForm({ id, record, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<EditState>(() => initialFormFrom(record))
  const [saving, setSaving] = useState(false)

  const setLine = (idx: number, patch: Partial<EditLine>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }))

  const save = async () => {
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
    onSaved()
  }

  return (
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
          <span className="mb-1 block text-sm font-medium text-zinc-700">Delivery Receipt No.</span>
          <input
            value={form.deliveryReceiptNumber}
            onChange={(e) => setForm({ ...form, deliveryReceiptNumber: e.target.value })}
            placeholder="e.g. DR-00123"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Supplier Invoice No.</span>
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
          const line = record.lines?.find((r) => r.id === l.id)
          return (
            <div key={l.id} className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-[12px] font-medium text-zinc-800">
                {line?.item?.name ?? l.id}
                <span className="ml-2 font-normal text-zinc-400">
                  {line?.quantityReceived} received · {line?.unitCost != null ? line.unitCost : '—'}{' '}
                  unit cost
                  <span className="ml-1 text-[11px]">(not editable)</span>
                </span>
              </p>
              {/* items-start, not items-end — Discounts can grow to several
                  rows once more than one is added, and bottom-aligning the
                  row would pin SRP/Tax/Batch/Notes to that growing height
                  instead of letting each field start level at the top. */}
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2 text-[12px]">
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
                          discounts: [...l.discounts, { value: '', type: 'percentage' as const }],
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
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </section>
  )
}
