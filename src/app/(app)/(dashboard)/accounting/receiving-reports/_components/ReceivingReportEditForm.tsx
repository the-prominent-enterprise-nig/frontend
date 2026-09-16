'use client'

import { Fragment, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { updateReceivingReport } from '../../../inventory/goods-receiving/_actions/update-receiving-report'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'

// Same class ReceiveStockModal.tsx / ReceiveAgainstPoModal.tsx use for their
// own table-cell inputs — kept identical so the three forms read as one
// document, not three that happen to agree today.
// No width baked in — callers add their own (w-full for a table cell that
// should fill it, a fixed w-NN for a compact field like SRP/Tax/Discount).
// Baking in w-full here and then trying to override it with a second width
// utility of equal specificity is exactly what made the Discounts value box
// stretch to fill the row instead of staying compact.
const cellInputClass =
  'rounded border border-zinc-200 px-2 py-1 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

interface EditLine {
  id: string
  batchNumber: string
  notes: string
  srp: string
  // The whole chain, not just the first link — same shape the Receive
  // Against PO drawer captures, so a receipt taken off a PO with "3% then
  // ₱500" can be corrected here without losing the second step.
  discounts: { value: string; type: 'percentage' | 'amount' }[]
  taxCode: string
  taxAmount: string
}

interface EditState {
  supplierInvoiceNumber: string
  deliveryReceiptNumber: string
  notes: string
  lines: EditLine[]
  costCorrectionReason: string
}

function initialFormFrom(record: ReceivingReport): EditState {
  return {
    supplierInvoiceNumber: record.supplierInvoiceNumber ?? '',
    deliveryReceiptNumber: record.deliveryReceiptNumber ?? '',
    notes: record.notes ?? '',
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

/** en-PH date, matching how the printed documents show it. */
function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Scenario 46 — correcting a receiving report after the fact. Laid out to
 * match "Receive Stock Against PO" (ReceiveAgainstPoModal.tsx) at the
 * developer's explicit instruction (2026-09-15): the document a receipt is
 * filled in on and the one it's corrected on should read as one form, not
 * two that happen to drift apart. Destination and Date Received are shown
 * the same way that form shows them, but as plain read-only display here —
 * unlike an in-progress receiving, nothing here can move the warehouse or
 * the date goods already landed.
 *
 * Quantity and serial numbers are absent and stay absent — both moved
 * physical stock (or claimed a specific physical unit) when this posted, so
 * a document that disagrees with the warehouse would be worse than one that
 * disagrees with the books. The fix for a wrong quantity is a stock count.
 *
 * Unit cost used to be absent for the same reason and no longer is (Scenario
 * 51). It is the one figure here that reaches the ledger — but as of
 * 2026-09-15, at the developer's explicit instruction reversing the feature's
 * original design, it is no longer independently typed. It is DERIVED from
 * SRP run through the discount chain and brought net of VAT, the same
 * arithmetic receiving itself performs; correcting SRP is what corrects the
 * cost, and the derived figure is what posts the adjusting entry (splitting
 * the difference between stock still on hand and COGS for units already
 * sold). A line with no SRP has nothing to derive from, and its cost cannot
 * be corrected here at all. Everything else on this form — discounts, tax,
 * batch, notes — corrects THIS REPORT only and re-posts nothing. VAT and
 * withholding are read-only for the same reason they're read-only on the
 * receiving form itself: auto-computed from the supplier's own registration
 * and terms, never a figure anyone types in.
 *
 * Shared between the Goods Receiving detail screen and the PO's Delivery
 * Receipts drawer, so a correction made from either place is the exact same
 * form rather than two copies that could quietly drift apart.
 */
export default function ReceivingReportEditForm({ id, record, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<EditState>(() => initialFormFrom(record))
  const [saving, setSaving] = useState(false)
  // "View original" per line — which lines are showing their as-loaded
  // snapshot. Nothing here is ever deeper history: there is no audit trail on
  // this table, so "original" can only ever mean what this line looked like
  // when this form opened. Once a correction saves, that becomes the new
  // baseline the next edit session opens with.
  const [showingOriginal, setShowingOriginal] = useState<Set<string>>(new Set())
  const toggleOriginal = (lineId: string) =>
    setShowingOriginal((s) => {
      const next = new Set(s)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })

  const setLine = (idx: number, patch: Partial<EditLine>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }))

  // Scenario 51 (2026-09-15, developer instruction) — Unit cost is no longer
  // its own typed field. It is derived from SRP run through the discount
  // chain, brought onto the same net-of-VAT footing receiving itself stores
  // it at — correct SRP (what's actually on the supplier's invoice) and Unit
  // cost follows. This is deliberately the opposite of the original Scenario
  // 51 design (an independent override) — a full reversal, made explicitly,
  // not a refinement of it.
  //
  // The receipt does not record its own VatTreatment, so the net share is
  // recovered the same way receiveStock() derives it in the first place: the
  // lines hold the net, gross is net + the receipt's own stored VAT.
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

  // Scenario 51 — which lines have had their cost actually moved. Compared
  // against what was loaded, not merely against empty, so simply opening the
  // form and saving is not a correction and raises no entry. A line with no
  // SRP derives to null and never appears here — nothing on this form can
  // move its cost.
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

  // Scenario 51 — the summary block, matching "Receive Stock Against PO"'s
  // own. Display only: nothing here is sent anywhere, it just totals numbers
  // already on screen elsewhere so the reader doesn't have to. Stock value
  // follows the form's CURRENT unit costs (live, the same way the amber
  // panel below updates as you type) rather than the originally-posted
  // figures — the whole point is showing what accepting the edit implies.
  const stockValue = form.lines.reduce((sum, l) => {
    const original = record.lines?.find((r) => r.id === l.id)
    const qty = Number(original?.quantityReceived ?? 0)
    // Falls back to the stored cost when a line has no SRP to derive from —
    // stockValue should reflect the real total either way, not zero out a
    // line this form simply can't correct.
    const cost = derivedUnitCost(l) ?? Number(original?.unitCost ?? 0)
    return sum + qty * (Number.isFinite(cost) ? cost : 0)
  }, 0)
  // VAT/withholding are the receipt's own stored figures — read-only, and
  // Scenario 51's correction never recomputes them, so they hold steady even
  // while stockValue moves under an edit.
  const inputVat = Number(record.vatAmount ?? 0)
  const withheld = Number(record.withheldAmount ?? 0)
  const invoiceTotal = stockValue + inputVat
  const payableToSupplier = invoiceTotal - withheld

  const save = async () => {
    setSaving(true)
    const res = await updateReceivingReport(id, {
      supplierInvoiceNumber: form.supplierInvoiceNumber || undefined,
      deliveryReceiptNumber: form.deliveryReceiptNumber || undefined,
      notes: form.notes || undefined,
      // vatAmount/withheldAmount are deliberately absent — see the read-only
      // boxes below. Auto-computed at receiving time; this screen only
      // displays them.
      //
      // Sent only when a cost actually moved. The server rejects a reason that
      // explains nothing, so passing it unconditionally would fail every
      // ordinary save.
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
        // every other field here. The backend still receives a plain number,
        // exactly as it always has; only where this number now comes from
        // has changed.
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

      {/* Destination / Date Received — shown the way "Receive Stock Against
          PO" shows them, but locked: the goods already landed at this
          warehouse on this date, and nothing here should move either. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Destination</span>
          <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            {record.warehouse?.branch?.name ?? record.warehouse?.name ?? '—'}
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Date Received</span>
          <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            {fmtDate(record.receivedAt)}
          </div>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
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
      </div>

      {/* Read-only, matching how "Receive Stock Against PO" shows these —
          auto-computed at receiving from the supplier's VAT registration and
          withholding terms, never a figure someone types in. Nothing here
          can drift from what the receipt actually posted, because nothing
          here can be typed. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">
            Input VAT <span className="font-normal text-zinc-400">12% of the invoice</span>
          </span>
          <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-sm text-zinc-600">
            {fmtMoney(record.vatAmount)}
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">
            Withholding tax <span className="font-normal text-zinc-400">1% — BIR 2307</span>
          </span>
          <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-sm text-zinc-600">
            {fmtMoney(record.withheldAmount)}
          </div>
        </label>
      </div>

      {/* Scenario 51 — the same left/right summary "Receive Stock Against PO"
          shows, purely computed from figures already on this screen. Stock
          value follows the CURRENT (possibly just-edited) unit costs, so this
          updates live the same way the amber panel below does. */}
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm sm:grid-cols-2">
        <div className="flex items-center justify-between">
          <span className="text-zinc-600">Stock value</span>
          <span className="tabular-nums">{fmtMoney(stockValue)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-600">Input VAT (12%)</span>
          <span className="tabular-nums">{fmtMoney(inputVat)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-600">Withholding (1%, BIR 2307)</span>
          <span className="tabular-nums">−{fmtMoney(withheld)}</span>
        </div>
        <div className="flex items-center justify-between font-semibold text-zinc-800">
          <span>Invoice total</span>
          <span className="tabular-nums">{fmtMoney(invoiceTotal)}</span>
        </div>
        <div className="col-span-full flex items-center justify-between border-t border-zinc-200 pt-1.5 font-semibold text-zinc-900">
          <span>Payable to supplier (net of withholding)</span>
          <span className="tabular-nums">{fmtMoney(payableToSupplier)}</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty Received</th>
              <th className="px-3 py-2">Batch No.</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {form.lines.map((l, idx) => {
              const line = record.lines?.find((r) => r.id === l.id)
              const changed = costChanges.some((c) => c.idx === idx)
              const serials = line?.serialNumbers ?? []
              return (
                <Fragment key={l.id}>
                  <tr className="border-t border-zinc-200">
                    <td className="px-3 py-2 align-top">
                      <div>{line?.item?.name ?? l.id}</div>
                      {/* Serials shown, never editable — a serial claims a
                          specific physical unit at receipt, same reasoning
                          as quantity. */}
                      {serials.length > 0 && (
                        <div className="mt-0.5 text-xs text-zinc-400">
                          Serials: {serials.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-500">
                      {line?.quantityReceived}
                      <span className="ml-1 text-xs">(not editable)</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={l.batchNumber}
                        onChange={(e) => setLine(idx, { batchNumber: e.target.value })}
                        placeholder="Optional"
                        className={`w-full ${cellInputClass}`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={l.notes}
                        onChange={(e) => setLine(idx, { notes: e.target.value })}
                        placeholder="Optional"
                        className={`w-full ${cellInputClass}`}
                      />
                    </td>
                  </tr>
                  {/* PRICING sub-row — same layout "Receive Stock Against PO"
                      uses under each line, so the corrected receipt reads
                      exactly the way the original receiving did. */}
                  <tr key={`${l.id}-pricing`} className="border-t border-zinc-100 bg-zinc-50/60">
                    <td colSpan={4} className="px-3 py-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          Pricing
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleOriginal(l.id)}
                          className="text-[11px] font-medium text-purple-700 hover:underline"
                        >
                          {showingOriginal.has(l.id) ? 'Hide original' : 'View original'}
                        </button>
                      </div>
                      {/* "Original" only ever means what this line held when
                          this form opened — there is no audit trail on
                          GoodsReceiptLine, so nothing deeper than that is
                          recoverable. Said plainly here rather than implying
                          a full history that doesn't exist. */}
                      {showingOriginal.has(l.id) && (
                        <div className="mb-2 rounded border border-zinc-200 bg-white px-3 py-2 text-[12px] text-zinc-600">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                            As loaded, before this edit
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            <span>SRP: {line?.srp != null ? fmtMoney(line.srp) : '—'}</span>
                            <span>
                              Discounts:{' '}
                              {line?.discounts?.length
                                ? line.discounts
                                    .map((d) =>
                                      d.type === 'percentage' ? `${d.value}%` : fmtMoney(d.value)
                                    )
                                    .join(' then ')
                                : 'None'}
                            </span>
                            <span>
                              Tax: {line?.taxCode || '—'}
                              {line?.taxAmount != null ? ` · ${fmtMoney(line.taxAmount)}` : ''}
                            </span>
                            <span className="font-medium text-zinc-700">
                              Unit cost: {line?.unitCost != null ? fmtMoney(line.unitCost) : '—'}
                            </span>
                          </div>
                        </div>
                      )}
                      {/* SRP / Tax / Unit cost — the compact fields — on their
                          own row; Discounts moved below since its list of
                          rows can grow tall and was crowding this one. */}
                      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-zinc-500">SRP</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.srp}
                            onChange={(e) => setLine(idx, { srp: e.target.value })}
                            className={`w-28 ${cellInputClass}`}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-zinc-500">Tax</span>
                          <div className="flex items-center gap-1">
                            <select
                              value={l.taxCode}
                              onChange={(e) => setLine(idx, { taxCode: e.target.value })}
                              className="rounded border border-zinc-200 px-1 py-1 text-sm"
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
                              className={`w-24 ${cellInputClass}`}
                            />
                          </div>
                        </label>
                        {/* Scenario 51 (2026-09-15) — read-only, derived from
                            SRP × the discount chain, net of VAT. Correct SRP
                            to correct the cost; this box only ever reports
                            the result. It is the one figure on this whole
                            block that reaches the ledger, so it is marked as
                            such even though it can no longer be typed into
                            directly. */}
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-amber-700">
                            Unit cost
                          </span>
                          <div
                            className={`w-28 rounded border px-2 py-1 text-right text-sm tabular-nums ${
                              changed
                                ? 'border-amber-400 bg-amber-50 font-semibold text-amber-900'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                            }`}
                          >
                            {derivedUnitCost(l) != null ? derivedUnitCost(l)!.toFixed(2) : '—'}
                          </div>
                        </label>
                      </div>
                      <div className="mt-2 flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-zinc-500">
                          Discounts <span className="normal-case text-zinc-400">(off SRP)</span>
                        </span>
                        <div className="flex flex-col gap-1">
                          {l.discounts.map((d, di) => (
                            <div key={di} className="flex items-center gap-1">
                              {/* Sign first, matching how the amount itself
                                    reads either way ("% off" or "₱ off") —
                                    the type is what the number that follows
                                    means, so it comes before it. */}
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
                                className="rounded border border-zinc-200 px-1 py-1 text-sm"
                              >
                                <option value="percentage">%</option>
                                <option value="amount">₱</option>
                              </select>
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
                                className={`w-20 ${cellInputClass}`}
                              />
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
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Scenario 51 — a cost correction posts to the ledger, so it says so
          before it is saved rather than after. Appears only once a cost has
          actually moved; every other edit on this form leaves the books alone
          and gets no warning it does not deserve. */}
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
          {/* Scenario 51 — a settled invoice does not stay settled once its
              subtotal moves. The correction itself takes care of writing the
              bill back to Partial when it's accepted on the AP side; this is
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
