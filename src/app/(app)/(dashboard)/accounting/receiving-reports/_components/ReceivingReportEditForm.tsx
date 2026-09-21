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
  driverName: string
  helperName: string
  notes: string
  vatAmount: string
  withheldAmount: string
  lines: EditLine[]
  costCorrectionReason: string
}

function initialFormFrom(record: ReceivingReport): EditState {
  return {
    supplierInvoiceNumber: record.supplierInvoiceNumber ?? '',
    deliveryReceiptNumber: record.deliveryReceiptNumber ?? '',
    driverName: record.driverName ?? '',
    helperName: record.helperName ?? '',
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
    costCorrectionReason: '',
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
 * Quantity is absent and stays absent: it moved physical stock when this
 * posted, so a document that disagrees with the warehouse would be worse than
 * one that disagrees with the books. Editing VAT or withholding here corrects
 * THIS REPORT only — the journal entry is not re-posted.
 *
 * Unit cost (Scenario 51) is the one figure here that reaches the ledger. It
 * is not independently typed — it is DERIVED from SRP run through the
 * discount chain and brought net of VAT, the same arithmetic receiving
 * itself performs. Correcting SRP is what corrects the cost, and the derived
 * figure is what posts the adjusting entry (splitting the difference between
 * stock still on hand and COGS for units already sold). A line with no SRP
 * has nothing to derive from, and its cost cannot be corrected here.
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

  // Scenario 51 — unit cost is derived from SRP run through the discount
  // chain, brought onto the same net-of-VAT footing receiving itself stores
  // it at. The receipt does not record its own VatTreatment, so the net
  // share is recovered the same way receiveStock() derives it in the first
  // place: the lines hold the net, gross is net + the receipt's own stored
  // VAT (its as-loaded value, not the form's — VAT here only backfills a
  // report's own field and never retriggers this math).
  const netTotal = (record.lines ?? []).reduce(
    (sum, l) => sum + Number(l.quantityReceived ?? 0) * Number(l.unitCost ?? 0),
    0
  )
  const receiptVat = Number(record.vatAmount ?? 0)
  const netShare = netTotal > 0 && receiptVat > 0 ? netTotal / (netTotal + receiptVat) : 1

  /** The line's unit cost, always computed — never independently stored.
   * Null when there is no SRP to derive from at all, in which case there is
   * nothing on this form that can correct this line's cost. */
  const derivedUnitCost = (l: EditLine): number | null => {
    if (l.srp === '') return null
    const srp = Number(l.srp)
    if (!Number.isFinite(srp)) return null
    const net = l.discounts
      .filter((d) => d.value !== '')
      .reduce((price, d) => {
        const v = Number(d.value)
        if (!Number.isFinite(v)) return price
        return d.type === 'percentage' ? price * (1 - v / 100) : price - v
      }, srp)
    return Math.round(net * netShare * 10000) / 10000
  }

  // Which lines have had their cost actually moved. Compared against what
  // was loaded, not merely against empty, so simply opening the form and
  // saving is not a correction and raises no entry.
  const costChanges = form.lines
    .map((l, idx) => {
      const original = record.lines?.find((r) => r.id === l.id)
      const from = original?.unitCost != null ? Number(original.unitCost) : 0
      const to = derivedUnitCost(l)
      if (to === null || to === from) return null
      return { idx, from, to, qty: Number(original?.quantityReceived ?? 0) }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  const correctionTotal = costChanges.reduce((sum, c) => sum + (c.to - c.from) * c.qty, 0)
  const reasonMissing = costChanges.length > 0 && form.costCorrectionReason.trim() === ''

  const save = async () => {
    setSaving(true)
    const res = await updateReceivingReport(id, {
      supplierInvoiceNumber: form.supplierInvoiceNumber || undefined,
      deliveryReceiptNumber: form.deliveryReceiptNumber || undefined,
      driverName: form.driverName || undefined,
      helperName: form.helperName || undefined,
      notes: form.notes || undefined,
      vatAmount: form.vatAmount === '' ? undefined : Number(form.vatAmount),
      withheldAmount: form.withheldAmount === '' ? undefined : Number(form.withheldAmount),
      // Sent only when a cost actually moved. The server rejects a reason
      // that explains nothing, so passing it unconditionally would fail
      // every ordinary save.
      costCorrectionReason: costChanges.length ? form.costCorrectionReason.trim() : undefined,
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
        // Sent only when the derived cost actually moved — same rule as
        // every other field here.
        unitCost: costChanges.find((c) => form.lines[c.idx].id === l.id)?.to,
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
          {costChanges.length > 0
            ? 'A unit cost changed — this will post an accounting entry'
            : 'Corrects the document — the posted journal entry is not recalculated'}
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
        {/* The report's "Driver/Helper" line. Editable here chiefly so
            receipts posted before the fields existed can have it filled in —
            the printed report has carried the line all along. */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Driver</span>
          <input
            value={form.driverName}
            onChange={(e) => setForm({ ...form, driverName: e.target.value })}
            placeholder="Name of whoever drove it in"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Helper</span>
          <input
            value={form.helperName}
            onChange={(e) => setForm({ ...form, helperName: e.target.value })}
            placeholder="Blank if the driver came alone"
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
          const changed = costChanges.some((c) => c.idx === idx)
          const cost = derivedUnitCost(l)
          return (
            <div key={l.id} className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-[12px] font-medium text-zinc-800">
                {line?.item?.name ?? l.id}
                <span className="ml-2 font-normal text-zinc-400">
                  {line?.quantityReceived} received
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
                {/* Scenario 51 — read-only, derived from SRP × the discount
                    chain, net of VAT. Correct SRP to correct the cost; this
                    box only ever reports the result. It is the one figure on
                    this whole line that reaches the ledger. */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Unit cost
                  </span>
                  <div
                    className={`w-28 rounded-lg border px-2 py-1.5 text-right tabular-nums ${
                      changed
                        ? 'border-amber-400 bg-amber-50 font-semibold text-amber-900'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    {cost != null ? cost.toFixed(2) : '—'}
                  </div>
                  {changed && (
                    <span className="text-[10px] text-amber-700">
                      was {line?.unitCost != null ? Number(line.unitCost).toFixed(2) : '—'}
                    </span>
                  )}
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

      {/* Scenario 51 — a cost correction posts to the ledger, so it says so
          before it is saved rather than after. Appears only once a cost has
          actually moved; every other edit on this form leaves the books
          alone and gets no warning it does not deserve. */}
      {costChanges.length > 0 && (
        <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <h3 className="text-[13px] font-semibold text-amber-900">
            This will post an accounting entry
          </h3>
          <ul className="mt-1.5 space-y-0.5 text-[12px] text-amber-800">
            {costChanges.map((c) => (
              <li key={c.idx}>
                {record.lines?.find((r) => r.id === form.lines[c.idx].id)?.item?.name ??
                  'This line'}
                : {c.from.toLocaleString()} → <strong>{c.to.toLocaleString()}</strong> × {c.qty}{' '}
                received
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-amber-800">
            {correctionTotal >= 0 ? (
              <>
                You will owe this supplier{' '}
                <strong>₱{Math.abs(correctionTotal).toLocaleString()} more</strong>.
              </>
            ) : (
              <>
                You will owe this supplier{' '}
                <strong>₱{Math.abs(correctionTotal).toLocaleString()} less</strong>.
              </>
            )}{' '}
            The difference is split between stock still on hand and cost of goods sold for units
            already sold — units sold at the old cost were recorded as more profitable than they
            were.
          </p>
          {/* A settled invoice does not stay settled once its subtotal
              moves. The correction itself takes care of writing the bill
              back to Partial when it's accepted on the AP side; this is
              only the warning, said before saving rather than discovered
              after. */}
          {record.apBill?.status === 'PAID' && (
            <p className="mt-2 rounded-md border border-amber-400 bg-amber-100 px-3 py-2 text-[12px] font-medium text-amber-900">
              The invoice behind this receipt is marked fully paid. Once this correction is accepted
              on the invoice, it will go back to partially paid — you will owe this supplier the
              difference.
            </p>
          )}
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] font-medium text-amber-900">
              Why did this cost change? <span className="text-red-600">*</span>
            </span>
            <input
              value={form.costCorrectionReason}
              onChange={(e) => setForm({ ...form, costCorrectionReason: e.target.value })}
              placeholder="e.g. Supplier invoice was higher than the PO"
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
            {reasonMissing && (
              <span className="mt-1 block text-[11px] font-medium text-red-700">
                A reason is required — it is the only record of why the books moved.
              </span>
            )}
          </label>
        </section>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving || reasonMissing}
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
