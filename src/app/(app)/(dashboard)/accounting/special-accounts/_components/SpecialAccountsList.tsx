'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Search } from 'lucide-react'
import {
  Expenses,
  fmtMoney,
  fmtDate,
  type SpecialAccountRegister,
  type SpecialAccountRow,
} from '@/src/libs/data/AccountingV2Data'
import NewSpecialAccountModal from './NewSpecialAccountModal'

/** Where a row's ledger lives. The pair (control account, name) is the
 * identity — a row that predates the register has no id to route by, and
 * those are the ones with the most history behind them. */
function ledgerHref(r: SpecialAccountRow) {
  return `/accounting/special-accounts/ledger?accountId=${encodeURIComponent(
    r.controlAccount.id
  )}&name=${encodeURIComponent(r.name)}`
}

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
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState<string | null>(null)

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
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
          >
            <Plus className="h-4 w-4" /> New Special Account
          </button>
        </div>
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

      {justCreated && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {justCreated} is open. It carries nothing until an expense line names it under the same
          control account.
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
                    : 'No special accounts yet — open one above, or name someone on an expense line under a control account.'}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={`${r.controlAccount.id}-${r.name}`} className="hover:bg-gray-50">
                  {/* The name is the way into the ledger — what was credited
                      and debited under it — which is the question this
                      register otherwise only answers as one net figure. */}
                  <td className="px-4 py-2.5 font-medium">
                    <Link
                      href={ledgerHref(r)}
                      className="text-purple-700 hover:text-purple-900 hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.employee && <span className="ml-2 text-[11px] text-gray-400">Employee</span>}
                    {r.customer && <span className="ml-2 text-[11px] text-gray-400">Customer</span>}
                  </td>
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

      {creating && (
        <NewSpecialAccountModal
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false)
            setJustCreated(name)
            // Clearing the search makes sure the new row is not filtered out
            // of the very list it was opened from; when it is already blank,
            // load() still has to run to fetch it.
            if (search) setSearch('')
            else load()
          }}
        />
      )}
    </div>
  )
}
