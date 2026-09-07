'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import {
  Expenses,
  fmtMoney,
  fmtDate,
  type SpecialAccountRegister,
} from '@/src/libs/data/AccountingV2Data'

/**
 * The Special Accounts register — who a balance is carried against, under
 * which control account, and how much is still out.
 *
 * Grouped by (control account, name) rather than by name alone: the same
 * person can be carried under more than one account, and an advance and a
 * loan are separate balances. Netting them would hide one behind the other.
 *
 * Only RECORDED entries count — a draft has not hit the books, so including
 * it would show a balance nobody owes yet.
 */
export default function SpecialAccountsList() {
  const [data, setData] = useState<SpecialAccountRegister | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await Expenses.specialAccounts({ search: search || undefined })
    if (res.success && res.data) setData(res.data)
    else setError(res.message || res.error || 'Failed to load special accounts')
    setLoading(false)
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const rows = data?.rows ?? []

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-prominent-purple-900">Special Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Balances carried against a named person — advances, loans and receivables — under the
            control account carrying each one.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-72 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-prominent-purple-400 focus:outline-none"
          />
        </div>
        {data && (
          <p className="text-xs text-gray-500">
            {data.totals.people} account{data.totals.people === 1 ? '' : 's'} ·{' '}
            {fmtMoney(data.totals.balance)} outstanding
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-2.5 text-left">Name</th>
              <th className="px-4 py-2.5 text-left">Control Account</th>
              <th className="px-4 py-2.5 text-right">Balance</th>
              <th className="px-4 py-2.5 text-right">Entries</th>
              <th className="px-4 py-2.5 text-left">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  {search
                    ? 'Nobody matches that name.'
                    : 'No special accounts yet — mark an expense line Yes under Special Account.'}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={`${r.controlAccount.id}-${r.name}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <span className="font-mono text-[12px] text-gray-400">
                      {r.controlAccount.number}
                    </span>{' '}
                    {r.controlAccount.name}
                  </td>
                  {/* Negative means more has been repaid than issued — worth
                      seeing rather than clamping to zero. */}
                  <td
                    className={`px-4 py-2.5 text-right font-medium ${
                      r.balance < 0 ? 'text-amber-700' : 'text-gray-900'
                    }`}
                  >
                    {fmtMoney(r.balance)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{r.entries}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {r.lastActivity ? fmtDate(r.lastActivity) : '—'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
