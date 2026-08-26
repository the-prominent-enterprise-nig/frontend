'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { getJournalEntryById, type JournalEntry } from '@/src/libs/data/AccountingData'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border border-amber-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  VOID: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function formatMoney(v: number | undefined | null) {
  if (!v) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)
}

function formatDate(v: string | undefined | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function JournalEntryDetail({ id }: { id: string }) {
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getJournalEntryById(id).then((res) => {
      if (res.success && res.data) setEntry(res.data)
      else setError(res.error ?? 'Journal entry not found')
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">Loading entry…</div>
  }

  if (error || !entry) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/accounting/journal-entries"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Journal Entries
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const transactions = entry.transactions ?? []
  const totalSubtotal = transactions.reduce((s, t) => {
    const q = t.quantity ?? 0
    const u = t.unitPrice ?? 0
    return s + q * u
  }, 0)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/accounting/journal-entries"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Journal Entries
      </Link>

      <header>
        <h1 className="font-mono text-2xl font-semibold text-gray-900">
          {entry.reference || entry.id.slice(0, 8)}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>{formatDate(entry.date)}</span>
          {entry.sourceModule ? (
            <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
              {entry.sourceModule}
            </span>
          ) : (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              MANUAL
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${STATUS_BADGE[entry.status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {entry.status === 'POSTED' && <CheckCircle2 className="h-4 w-4" />}
            {entry.status}
          </span>
        </div>
        <div className="mt-1.5 flex flex-col gap-1 text-xs text-gray-400">
          {entry.sourceDocumentNo && <span>Source document: {entry.sourceDocumentNo}</span>}
          <span>Branch: {entry.branchName ?? 'Tenant-wide'}</span>
          <span>Type: {entry.journalType || '—'}</span>
          {entry.payee && <span>Payee: {entry.payee}</span>}
          {entry.description && <span>Description: {entry.description}</span>}
          {entry.postedBy && (
            <span>
              Posted by: {entry.postedBy} · {formatDate(entry.postedAt)}
            </span>
          )}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Total Debit" value={formatMoney(entry.totalDebit)} />
        <StatBox label="Total Credit" value={formatMoney(entry.totalCredit)} />
        <StatBox label="Lines" value={String(transactions.length)} />
        <StatBox
          label="Balanced"
          value={Math.abs((entry.totalDebit ?? 0) - (entry.totalCredit ?? 0)) < 0.01 ? 'Yes' : 'No'}
          emphasize={Math.abs((entry.totalDebit ?? 0) - (entry.totalCredit ?? 0)) >= 0.01}
        />
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Transaction Lines</h2>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-gray-400">No transaction lines.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4 text-right">Qty</th>
                  <th className="py-2 pr-4 text-right">Unit Price</th>
                  <th className="py-2 pr-4 text-right">Subtotal</th>
                  <th className="py-2 pr-4 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t, i) => {
                  const qty = t.quantity
                  const unitPrice = t.unitPrice
                  const subtotal = qty != null && unitPrice != null ? qty * unitPrice : null
                  return (
                    <tr key={t.id ?? i}>
                      <td className="py-2 pr-4 text-gray-900">
                        {t.account ? `${t.account.number} — ${t.account.name}` : t.accountId}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{t.item || '—'}</td>
                      <td className="py-2 pr-4 text-gray-500">{t.description || '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{qty ?? '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {unitPrice != null ? formatMoney(unitPrice) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {subtotal != null ? formatMoney(subtotal) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium tabular-nums">
                        {t.debit ? formatMoney(t.debit) : '—'}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {t.credit ? formatMoney(t.credit) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-gray-300">
                <tr>
                  <td colSpan={5} className="py-2 pr-4 text-right font-semibold text-gray-600">
                    Total
                  </td>
                  <td className="py-2 pr-4 text-right font-bold tabular-nums">
                    {formatMoney(totalSubtotal)}
                  </td>
                  <td className="py-2 pr-4 text-right font-bold tabular-nums">
                    {formatMoney(entry.totalDebit)}
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums">
                    {formatMoney(entry.totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatBox({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${emphasize ? 'text-red-600' : 'text-gray-900'}`}
      >
        {value}
      </p>
    </div>
  )
}
