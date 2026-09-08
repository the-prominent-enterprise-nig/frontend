'use client'

import {
  fmtMoney,
  type ARInvoiceScheduleLine,
  type ARPayment,
} from '@/src/libs/data/AccountingV2Data'

/**
 * The plan's due dates, under the invoice that bills them.
 *
 * The invoice holds one receivable; these rows are what it is collected
 * across. Each carries its own settlement state (paidAmount/settledAt) rather
 * than the invoice's status, which is plan-wide and cannot say which month is
 * outstanding.
 *
 * Answers "which installment is due or overdue?" at a glance — the question
 * the old one-invoice-per-due layout forced you to answer by scanning twelve
 * separate rows in the AR list.
 */

type Status = 'Paid' | 'Partial' | 'Overdue' | 'Due' | 'Upcoming'

const BADGE: Record<Status, string> = {
  Paid: 'bg-emerald-50 text-emerald-700',
  Partial: 'bg-amber-50 text-amber-700',
  Overdue: 'bg-red-50 text-red-700',
  Due: 'bg-prominent-purple-50 text-prominent-purple-700',
  Upcoming: 'bg-gray-100 text-gray-600',
}

function fmtDate(v: string): string {
  return new Date(v).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Start of today, so a due dated today reads as Due rather than Overdue. */
function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function deriveStatus(
  line: ARInvoiceScheduleLine,
  isNextUnpaid: boolean,
  today = startOfToday()
): Status {
  if (line.settledAt) return 'Paid'
  // Past its date and still open — true regardless of a part payment, since
  // an underpaid due that has matured is still late.
  if (new Date(line.dueDate).getTime() < today) return 'Overdue'
  if (line.paidAmount > 0) return 'Partial'
  return isNextUnpaid ? 'Due' : 'Upcoming'
}

export default function InstallmentScheduleTable({
  lines,
  payments,
}: {
  lines: ARInvoiceScheduleLine[]
  payments: ARPayment[]
}) {
  if (lines.length === 0) return null

  const ordered = [...lines].sort((a, b) => a.lineNumber - b.lineNumber)
  // Collections are applied oldest-first, so the first unsettled due is the
  // one a collector should actually be chasing.
  const nextUnpaidId = ordered.find((l) => !l.settledAt)?.id ?? null

  // Which receipt settled which due — ARPayment carries the line it was
  // applied to, so a due can name its own CR instead of the reader having to
  // match amounts by eye against the payment history below.
  const receiptByLine = new Map<string, string>()
  for (const p of payments) {
    if (p.cancelledAt || !p.installmentScheduleLineId) continue
    const ref = p.receipt?.number ?? p.reference
    if (ref && !receiptByLine.has(p.installmentScheduleLineId)) {
      receiptByLine.set(p.installmentScheduleLineId, ref)
    }
  }

  const totals = ordered.reduce(
    (a, l) => ({
      amount: a.amount + l.amount,
      paid: a.paid + l.paidAmount,
    }),
    { amount: 0, paid: 0 }
  )

  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-[14px] font-semibold text-prominent-purple-900">
        Installment schedule
      </h2>
      <p className="mb-3 text-[12px] text-gray-500">
        {ordered.length} due date{ordered.length === 1 ? '' : 's'} on this plan. Collections apply
        to the earliest unpaid due first.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-[13px]">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-4 w-10">#</th>
              <th className="py-2 pr-4">Due date</th>
              <th className="py-2 pr-4 text-right">Amount</th>
              <th className="py-2 pr-4 text-right">Paid</th>
              <th className="py-2 pr-4 text-right">Balance</th>
              <th className="py-2 pr-4">Receipt</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordered.map((l) => {
              const status = deriveStatus(l, l.id === nextUnpaidId)
              const balance = Math.round((l.amount - l.paidAmount) * 100) / 100
              return (
                <tr key={l.id} className={status === 'Overdue' ? 'bg-red-50/40' : undefined}>
                  <td className="py-2 pr-4 text-gray-500">{l.lineNumber}</td>
                  <td className="py-2 pr-4 whitespace-nowrap text-gray-900">
                    {fmtDate(l.dueDate)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtMoney(l.amount)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-emerald-700">
                    {l.paidAmount > 0 ? fmtMoney(l.paidAmount) : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {balance > 0 ? fmtMoney(balance) : '—'}
                  </td>
                  <td className="py-2 pr-4 font-mono text-[11.5px] text-gray-500">
                    {receiptByLine.get(l.id) ?? '—'}
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${BADGE[status]}`}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold">
              <td className="py-2 pr-4" colSpan={2}>
                Total
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{fmtMoney(totals.amount)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-emerald-700">
                {fmtMoney(totals.paid)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtMoney(Math.round((totals.amount - totals.paid) * 100) / 100)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
