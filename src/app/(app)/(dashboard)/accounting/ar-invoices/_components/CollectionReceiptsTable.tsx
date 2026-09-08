'use client'

import Link from 'next/link'

import {
  fmtMoney,
  type ARInvoiceScheduleLine,
  type ARPayment,
} from '@/src/libs/data/AccountingV2Data'
import { collectionReceiptHref } from '../receipts/view/_components/CollectionReceiptDetail'

/**
 * What we actually received against this invoice.
 *
 * A collection receipt is money in hand — distinct from the invoice (what was
 * billed) and the schedule (what is expected, and when). A payment never
 * creates another AR Invoice; it credits this one, which is why every row
 * here names the due it was applied to rather than standing alone.
 *
 * Replaces the old free-text "Payment history" list, which ran the date,
 * method and reference together in one sentence and gave no column for what
 * a payment was applied to.
 */

function fmtDate(v: string): string {
  return new Date(v).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CollectionReceiptsTable({
  invoiceId,
  payments,
  scheduleLines,
  customer,
  enterprise,
  appliedToReference,
  invoiceDate,
  totalAmount,
  saleReference,
}: {
  invoiceId: string
  payments: ARPayment[]
  scheduleLines: ARInvoiceScheduleLine[]
  customer?: { name?: string | null; address?: string | null; taxId?: string | null } | null
  enterprise?: { companyLegalName?: string | null; address?: string | null } | null
  /** The invoice reference a receipt credits, as the customer knows it. */
  appliedToReference: string
  invoiceDate: string
  totalAmount: number
  saleReference: string
}) {
  const isPlan = scheduleLines.length > 0
  const lineNumber = new Map(scheduleLines.map((l) => [l.id, l.lineNumber]))

  const labelFor = (p: ARPayment): string => {
    const due = p.installmentScheduleLineId
      ? lineNumber.get(p.installmentScheduleLineId)
      : undefined
    if (due) return `Installment #${due}`
    return isPlan ? 'Downpayment' : 'Payment'
  }

  // Sale, then each live collection, balance drawn down as it goes.
  const ledgerRows = (() => {
    const live = [...payments]
      .filter((p) => !p.cancelledAt)
      .sort((a, b) => +new Date(a.paymentDate) - +new Date(b.paymentDate))
    let balance = totalAmount
    const out = [
      {
        date: invoiceDate,
        ref: saleReference,
        inst: null as number | null,
        description: 'Sale',
        debit: totalAmount,
        credit: 0,
        balance,
      },
    ]
    for (const p of live) {
      const credit =
        Math.round((p.amount + (p.withholdingAmount ?? 0) + (p.rebateAmount ?? 0)) * 100) / 100
      balance = Math.round((balance - credit) * 100) / 100
      const due = p.installmentScheduleLineId
        ? lineNumber.get(p.installmentScheduleLineId)
        : undefined
      out.push({
        date: p.paymentDate,
        ref: p.reference || p.receipt?.number || '—',
        inst: due ?? null,
        description: due ? `Installment #${due}` : isPlan ? 'Down payment' : 'Payment',
        debit: 0,
        credit,
        balance,
      })
    }
    return out
  })()

  const rows = [...payments].sort((a, b) => +new Date(a.paymentDate) - +new Date(b.paymentDate))

  // Only live applications count toward what has been collected — a cancelled
  // one never reduced the balance, so including it would disagree with the
  // Outstanding figure above.
  const totalApplied =
    Math.round(
      rows
        .filter((p) => !p.cancelledAt)
        .reduce((s, p) => s + p.amount + (p.withholdingAmount ?? 0) + (p.rebateAmount ?? 0), 0) *
        100
    ) / 100

  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-[14px] font-semibold text-prominent-purple-900">
        Payments / Collection Receipts
      </h2>
      <p className="mb-3 text-[12px] text-gray-500">
        Money actually received against this invoice. A payment credits this invoice — it never
        creates another one.
      </p>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-gray-400">No collections recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-[13px]">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Receipt no.</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Applied to</th>
                <th className="py-2 pr-4 text-right">Received</th>
                <th className="py-2 text-right">Applied here</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((p) => {
                const due = p.installmentScheduleLineId
                  ? lineNumber.get(p.installmentScheduleLineId)
                  : undefined
                const applied =
                  Math.round(
                    (p.amount + (p.withholdingAmount ?? 0) + (p.rebateAmount ?? 0)) * 100
                  ) / 100
                return (
                  <tr key={p.id} className={p.cancelledAt ? 'opacity-50' : undefined}>
                    <td className="py-2 pr-4 whitespace-nowrap text-gray-900">
                      {fmtDate(p.paymentDate)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[11.5px]">
                      {/* Opens the CR as its own document. A collection
                          receipt is a separate transaction linked to this
                          invoice, not a line of it — the CR off the physical
                          booklet labels it, the generated number only backs
                          up payments taken before one was required. */}
                      <Link
                        href={collectionReceiptHref([{ arInvoiceId: invoiceId, paymentId: p.id }])}
                        className="text-purple-600 hover:underline"
                      >
                        {p.reference || p.receipt?.number || 'View receipt'}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{p.method ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {due ? (
                        <span className="text-gray-800">Installment #{due}</span>
                      ) : isPlan ? (
                        <span className="rounded-full bg-prominent-purple-50 px-2 py-0.5 text-[11px] font-medium text-prominent-purple-700">
                          Downpayment
                        </span>
                      ) : (
                        <span className="text-gray-500">Invoice</span>
                      )}
                      {p.cancelledAt && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                          cancelled
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-600">
                      {/* The whole tender when this row is one slice of a
                          wider receipt that also settled other dues. */}
                      {p.receipt ? fmtMoney(p.receipt.amount) : fmtMoney(applied)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums text-emerald-700">
                      {fmtMoney(applied)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-semibold">
                <td className="py-2 pr-4" colSpan={5}>
                  Total collected
                </td>
                <td className="py-2 text-right tabular-nums text-emerald-700">
                  {fmtMoney(totalApplied)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {/* Collection receipt, as a ledger: the sale it credits, then every
          collection actually received against it, with the balance drawn
          down row by row. Same shape as the contract ledger in CRM so the
          two read alike — and it stops at the collections that really
          happened rather than projecting the whole schedule. */}
      <div className="mt-5 overflow-x-auto">
        <h3 className="mb-2 text-[13px] font-semibold text-prominent-purple-900">
          Collection Receipt
        </h3>
        <table className="min-w-full divide-y divide-gray-100 text-[13px]">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Ref</th>
              <th className="py-2 pr-4 text-right">Inst.</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 pr-4 text-right">Debit</th>
              <th className="py-2 pr-4 text-right">Credit</th>
              <th className="py-2 pr-4 text-right">Due</th>
              <th className="py-2 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ledgerRows.map((r, i) => (
              <tr key={`led-${i}`}>
                <td className="py-2 pr-4 whitespace-nowrap text-gray-600">{fmtDate(r.date)}</td>
                <td className="py-2 pr-4 text-gray-400">{r.ref}</td>
                <td className="py-2 pr-4 text-right text-gray-500">{r.inst ?? '—'}</td>
                <td className="py-2 pr-4 text-gray-900">{r.description}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {r.debit ? fmtMoney(r.debit) : '—'}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {r.credit ? fmtMoney(r.credit) : '—'}
                </td>
                <td
                  className={`py-2 pr-4 text-right tabular-nums ${r.credit ? 'text-red-600' : ''}`}
                >
                  {r.credit ? `−${fmtMoney(r.credit)}` : fmtMoney(r.debit)}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {fmtMoney(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold">
              <td className="py-2 pr-4" colSpan={4}>
                Total
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtMoney(ledgerRows.reduce((a, r) => a + r.debit, 0))}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtMoney(ledgerRows.reduce((a, r) => a + r.credit, 0))}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
