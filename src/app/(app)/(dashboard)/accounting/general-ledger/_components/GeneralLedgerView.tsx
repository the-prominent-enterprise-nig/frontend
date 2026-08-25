'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Reports, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'

const TODAY = new Date().toISOString().slice(0, 10)
const YEAR_START = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

export default function GeneralLedgerView() {
  const searchParams = useSearchParams()
  const [startDate, setStartDate] = useState(YEAR_START)
  const [endDate, setEndDate] = useState(TODAY)
  const [accounts, setAccounts] = useState<Account[]>([])
  // A running balance only makes sense scoped to one account, so it's
  // opt-in via this filter — no account selected means the flat
  // multi-account view with no Balance column.
  const [accountId, setAccountId] = useState(searchParams.get('accountId') ?? '')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setData(null)
    const res = await Reports.generalLedger({
      accountId: accountId || undefined,
      startDate,
      endDate,
    })
    setData(res?.data ?? null)
    setLoading(false)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const items = Array.isArray(r.data) ? r.data : ((r.data as any)?.items ?? [])
      setAccounts(items as Account[])
    })
  }, [])

  const rows = Array.isArray(data) ? data : []
  const showBalance = !!accountId

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">General Ledger</h2>
      <p className="text-sm text-gray-500 mb-4">
        Every posted journal entry line, in date order. Select an account to see its running
        balance.
      </p>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Account</label>
          <select
            aria-label="Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-56"
          >
            <option value="">— All accounts (no running balance) —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} {a.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Run Report'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {!data ? (
          <div className="text-center text-gray-400 py-8">Run the report to see data.</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No posted transactions in this range.
          </div>
        ) : (
          <Table
            headers={
              showBalance
                ? ['Date', 'Reference', 'Account', 'Description', 'Debit', 'Credit', 'Balance']
                : ['Date', 'Reference', 'Account', 'Description', 'Debit', 'Credit']
            }
          >
            {rows.map((t: any) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-xs">{fmtDate(t.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.reference || '—'}</td>
                <td className="px-3 py-2">
                  {t.account?.number} {t.account?.name}
                </td>
                <td className="px-3 py-2 text-gray-500">{t.description || '—'}</td>
                <td className="px-3 py-2 text-right">{t.debit ? fmtMoney(t.debit) : '—'}</td>
                <td className="px-3 py-2 text-right">{t.credit ? fmtMoney(t.credit) : '—'}</td>
                {showBalance && (
                  <td className="px-3 py-2 text-right font-medium">{fmtMoney(t.balance ?? 0)}</td>
                )}
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-3 py-2 text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  )
}
