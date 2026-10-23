'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  ARInvoices,
  fmtDate,
  fmtMoney,
  type RetentionSchedule as Schedule,
} from '@/src/libs/data/AccountingV2Data'

/**
 * Every invoice still holding a customer retention: what was held back, what has
 * left it, when the rest is due. The held total is checked against the
 * Retention Receivable account, so a gap between the schedule and the ledger
 * shows here rather than at year end.
 */
export default function RetentionSchedule() {
  const [data, setData] = useState<Schedule | null>(null)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    ARInvoices.retentionSchedule().then((res) => {
      if (cancelled) return
      if (res.success && res.data) setData(res.data)
      else setError(res.error || res.message || 'Could not load the retention schedule.')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="px-6 py-6 lg:px-10">
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex items-center gap-2 px-6 py-6 text-sm text-gray-500 lg:px-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  const rows = showAll ? data.items : data.items.filter((i) => i.held > 0)
  const gap = data.difference ?? 0

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link
        href="/accounting/ar-invoices"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to AR invoices
      </Link>
      <h1 className="text-2xl font-bold text-prominent-purple-900">Customer retention</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        What customers are holding back under their contracts, and when it is due. Open an invoice
        to record a release, an offset against a claim, or a doubtful retention.
      </p>

      <div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-4">
        <Fact
          label="Held by customers"
          value={fmtMoney(data.totals.held)}
          testId="retention-total"
        />
        <Fact label="Past its release date" value={fmtMoney(data.totals.pastDue)} />
        <Fact
          label="Retention Receivable in the ledger"
          value={data.glBalance == null ? '—' : fmtMoney(data.glBalance)}
        />
        <Fact
          label="Difference"
          value={data.difference == null ? '—' : fmtMoney(gap)}
          warn={Math.abs(gap) >= 0.01}
          hint={Math.abs(gap) >= 0.01 ? 'The schedule and the ledger disagree' : undefined}
        />
      </div>

      <label className="mt-5 inline-flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Include invoices whose retention is fully settled
      </label>

      <div
        data-testid="retention-table"
        className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white"
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-right">Retained</th>
              <th className="px-3 py-2 text-right">Released</th>
              <th className="px-3 py-2 text-right">Offset</th>
              <th className="px-3 py-2 text-right">Written off</th>
              <th className="px-3 py-2 text-right">Provided for</th>
              <th className="px-3 py-2 text-right">Held</th>
              <th className="px-3 py-2 text-left">Release due</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                  No customer is holding retention.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.arInvoiceId} className="border-t border-gray-100 hover:bg-purple-50/40">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      href={`/accounting/ar-invoices/${r.arInvoiceId}`}
                      className="font-mono text-xs font-semibold text-purple-700 hover:underline"
                    >
                      {r.invoiceNumber}
                    </Link>
                    <div className="text-[11px] text-gray-500">{fmtDate(r.invoiceDate)}</div>
                  </td>
                  <td className="px-3 py-2">{r.customerName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.retentionPercent ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.retained)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.released)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.offset)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.writtenOff)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.provided)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {fmtMoney(r.held)}
                  </td>
                  <td className="px-3 py-2">
                    {r.releaseDate ? fmtDate(r.releaseDate) : '—'}
                    {r.daysPastDue > 0 && (
                      <div className="text-[11px] font-medium text-red-600">
                        {r.daysPastDue} days past due
                      </div>
                    )}
                    {r.milestone && <div className="text-[11px] text-gray-500">{r.milestone}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Fact({
  label,
  value,
  hint,
  warn,
  testId,
}: {
  label: string
  value: string
  hint?: string
  warn?: boolean
  testId?: string
}) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div
        data-testid={testId}
        className={`mt-0.5 text-lg font-semibold tabular-nums ${warn ? 'text-red-700' : 'text-prominent-purple-900'}`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-red-600">{hint}</div>}
    </div>
  )
}
