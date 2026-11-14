'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  BankAccounts,
  fmtDate,
  fmtMoney,
  type BankAccountTransactions,
} from '@/src/libs/data/AccountingV2Data'
import { manilaToday } from '@/src/libs/format/manila-date'

interface Range {
  startDate: string
  endDate: string
}

/** This month so far, in Manila: what a cashier checks first. */
function defaultRange(): Range {
  const today = manilaToday()
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today }
}

function useAccountTransactions(id: string): {
  data: BankAccountTransactions | null
  loading: boolean
  error: string | null
  load: (range: Range) => Promise<void>
} {
  const [data, setData] = useState<BankAccountTransactions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    async (range: Range): Promise<void> => {
      setLoading(true)
      setError(null)
      const res = await BankAccounts.getTransactions(id, {
        startDate: range.startDate || undefined,
        endDate: range.endDate || undefined,
      })
      if (res.success && res.data) setData(res.data)
      else setError(res.message || res.error || 'Failed to load transactions')
      setLoading(false)
    },
    [id]
  )
  return { data, loading, error, load }
}

/**
 * The balance drill-down on Cash & Banking › Bank and Cash Accounts: every
 * posted movement on one account, newest first, with its running balance.
 * Read only. A Branch Cashier lands here from their branch's petty cash
 * fund; the server refuses any account they may not view.
 */
export default function AccountTransactions({ id }: { id: string }): JSX.Element {
  const [range, setRange] = useState<Range>(defaultRange)
  const { data, loading, error, load } = useAccountTransactions(id)

  // First load only; later loads come from Apply or Clear with their range.
  useEffect(() => {
    load(defaultRange())
  }, [load])

  const apply = (next: Range): void => {
    setRange(next)
    load(next)
  }

  return (
    <div className="w-full px-4 py-6 md:px-6 lg:px-10">
      <Link
        href="/accounting/bank-accounts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Bank and Cash Accounts
      </Link>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <Header data={data} />
        <FilterBar range={range} loading={loading} onChange={setRange} onApply={apply} />
        {data && !error && <Summary data={data} />}
        {error ? (
          <p className="px-5 py-6 text-sm text-red-600">{error}</p>
        ) : (
          <TransactionsTable data={data} loading={loading} />
        )}
      </div>
    </div>
  )
}

function Header({ data }: { data: BankAccountTransactions | null }): JSX.Element {
  const account = data?.account
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{account?.name ?? 'Transactions'}</h1>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {account ? `${account.bankName} · ${account.accountNumber}` : 'Loading account…'}
        </p>
      </div>
      {account && (
        <div className="text-right">
          <p className="text-xs text-ink-subtle">Current balance</p>
          <p className="text-lg font-semibold text-gray-900">{fmtMoney(account.currentBalance)}</p>
        </div>
      )}
    </div>
  )
}

function FilterBar({
  range,
  loading,
  onChange,
  onApply,
}: {
  range: Range
  loading: boolean
  onChange: (range: Range) => void
  onApply: (range: Range) => void
}): JSX.Element {
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    onApply(range)
  }
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3"
    >
      <DateField
        label="From"
        value={range.startDate}
        onChange={(startDate) => onChange({ ...range, startDate })}
      />
      <DateField
        label="To"
        value={range.endDate}
        onChange={(endDate) => onChange({ ...range, endDate })}
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-purple-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Apply'}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => onApply({ startDate: '', endDate: '' })}
        className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
      >
        All dates
      </button>
    </form>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
      />
    </label>
  )
}

function Summary({ data }: { data: BankAccountTransactions }): JSX.Element {
  const tiles = [
    { label: 'Opening balance', value: data.openingBalance },
    { label: 'Total in', value: data.totalIn },
    { label: 'Total out', value: data.totalOut },
    { label: 'Ending balance', value: data.closingBalance },
  ]
  return (
    <div className="grid grid-cols-2 gap-px border-b border-gray-200 bg-gray-200 md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-white px-5 py-3">
          <p className="text-xs text-ink-subtle">{t.label}</p>
          <p className="text-base font-semibold text-gray-900">{fmtMoney(t.value)}</p>
        </div>
      ))}
    </div>
  )
}

function TransactionsTable({
  data,
  loading,
}: {
  data: BankAccountTransactions | null
  loading: boolean
}): JSX.Element {
  return (
    <div className="max-h-[60vh] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-ink-muted">
          <tr>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Reference</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-right">In</th>
            <th className="px-4 py-2 text-right">Out</th>
            <th className="px-4 py-2 text-right">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <TableBody data={data} loading={loading} />
        </tbody>
      </table>
    </div>
  )
}

function TableBody({
  data,
  loading,
}: {
  data: BankAccountTransactions | null
  loading: boolean
}): JSX.Element {
  if (loading || !data || data.transactions.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
          {loading ? 'Loading…' : 'No transactions in this period.'}
        </td>
      </tr>
    )
  }
  return (
    <>
      {data.transactions.map((t) => (
        <tr key={t.id}>
          <td className="whitespace-nowrap px-4 py-2 text-xs">{fmtDate(t.date)}</td>
          <td className="px-4 py-2 text-xs text-ink-subtle">{t.reference || '—'}</td>
          <td className="px-4 py-2 text-xs">{t.description || '—'}</td>
          <td className="px-4 py-2 text-right">{t.debit ? fmtMoney(t.debit) : '—'}</td>
          <td className="px-4 py-2 text-right">{t.credit ? fmtMoney(t.credit) : '—'}</td>
          <td className="px-4 py-2 text-right text-ink-muted">
            {t.balance === null ? '—' : fmtMoney(t.balance)}
          </td>
        </tr>
      ))}
    </>
  )
}
