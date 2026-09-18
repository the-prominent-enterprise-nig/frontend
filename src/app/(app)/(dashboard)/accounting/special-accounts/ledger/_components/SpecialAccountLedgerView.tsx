'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import {
  Expenses,
  fmtMoney,
  fmtDate,
  type SpecialAccountLedger,
} from '@/src/libs/data/AccountingV2Data'

/**
 * One Special Account's ledger — every peso that moved under that name on
 * that control account, oldest first.
 *
 * Debit and credit are two columns rather than one signed amount: that is
 * how the client reads a subsidiary ledger, and it is the only layout where
 * "what went out to them" and "what came back" can be totalled separately.
 * For a receivable-type control account a debit is money issued (an advance
 * released) and a credit is money recovered (a payroll deduction, a
 * liquidation), so the closing balance is what is still out.
 *
 * Only RECORDED entries appear — a draft has not hit the books, and showing
 * it here would put a figure in the running balance that no journal entry
 * backs.
 */
export default function SpecialAccountLedgerView({
  accountId,
  name,
}: {
  accountId: string
  name: string
}) {
  // Landing here without both halves of the identity is a bad link, not a
  // failed load — derived rather than pushed into state by the effect, so
  // the message renders on the first paint instead of after a round trip
  // that was never going to happen.
  const addressed = Boolean(accountId && name)

  const [data, setData] = useState<SpecialAccountLedger | null>(null)
  const [loading, setLoading] = useState(addressed)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!addressed) return
    setLoading(true)
    setError(null)
    const res = await Expenses.specialAccountLedger({ accountId, name })
    if (res.success && res.data) setData(res.data)
    else setError(res.message || res.error || 'Failed to load the ledger')
    setLoading(false)
  }, [accountId, name, addressed])

  useEffect(() => {
    void load()
  }, [load])

  const entries = data?.entries ?? []
  const balance = data?.totals.balance ?? 0
  const message = addressed ? error : 'This ledger needs both an account and a name.'

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/special-accounts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Special Accounts
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-prominent-purple-900">
            {data?.account.name || name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {data ? (
              <>
                <span className="font-mono text-[12px] text-gray-400">
                  {data.account.controlAccount.number}
                </span>{' '}
                {data.account.controlAccount.name}
              </>
            ) : (
              'Loading…'
            )}
          </p>
          {data && (data.account.employee || data.account.customer || data.account.notes) && (
            <p className="mt-1 text-xs text-gray-500">
              {data.account.employee && <>Employee: {data.account.employee.name}. </>}
              {data.account.customer && <>Customer: {data.account.customer.name}. </>}
              {data.account.notes}
            </p>
          )}
          {data && !data.account.id && (
            // Worth saying plainly: this balance was never opened by anyone,
            // it appeared the first time an entry named it. That is also why
            // its spelling is whatever was typed.
            <p className="mt-1 text-xs text-amber-700">
              Not on the register — this balance exists only in the entries that name it.
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-500">Outstanding</p>
            <p
              className={`text-2xl font-semibold ${
                balance < 0 ? 'text-amber-700' : 'text-gray-900'
              }`}
            >
              {fmtMoney(balance)}
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-2.5 text-left">Date</th>
              <th className="px-4 py-2.5 text-left">Reference</th>
              <th className="px-4 py-2.5 text-left">Particulars</th>
              <th className="px-4 py-2.5 text-left">Division</th>
              <th className="px-4 py-2.5 text-right">Debit (out)</th>
              <th className="px-4 py-2.5 text-right">Credit (in)</th>
              <th className="px-4 py-2.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && !message && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Nothing posted under this name yet.
                </td>
              </tr>
            )}
            {!loading &&
              entries.map((e, i) => (
                <tr key={`${e.expenseId}-${i}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {e.date ? fmtDate(e.date) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {/* The entry itself is where the full detail lives — the
                        other lines it paid, the payment, the voucher. */}
                    <Link
                      href={`/accounting/expenses/${e.expenseId}`}
                      className="text-purple-700 hover:underline"
                    >
                      {e.reference || 'View entry'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{e.description || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{e.divisionName || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">
                    {e.debit ? fmtMoney(e.debit) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">
                    {e.credit ? fmtMoney(e.credit) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                    {fmtMoney(e.balance)}
                  </td>
                </tr>
              ))}
          </tbody>
          {data && entries.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900">
              <tr>
                <td className="px-4 py-3" colSpan={4}>
                  Totals
                </td>
                <td className="px-4 py-3 text-right">{fmtMoney(data.totals.debit)}</td>
                <td className="px-4 py-3 text-right">{fmtMoney(data.totals.credit)}</td>
                <td className="px-4 py-3 text-right">{fmtMoney(data.totals.balance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
