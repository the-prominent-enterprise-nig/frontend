'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Reports, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import ExportButton from '@/src/components/common/ExportButton'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import { sourceDocumentLink } from '@/src/libs/format/sourceDocumentLink'

const TODAY = new Date().toISOString().slice(0, 10)
const YEAR_START = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

export default function GeneralLedgerView() {
  const searchParams = useSearchParams()
  // Scenario 62 — a figure clicked on a report opens this page pre-scoped
  // to that account and period (and, from a P&L, its branch/view), so the
  // lines listed are exactly the ones behind the figure. An explicit empty
  // startDate means "from the beginning" (an as-of report's balance).
  const [startDate, setStartDate] = useState(searchParams.get('startDate') ?? YEAR_START)
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || TODAY)
  const branchId = searchParams.get('branchId') ?? ''
  const view = searchParams.get('view') === 'internal' ? 'internal' : ''
  const drilled = searchParams.has('accountId')
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
      startDate: startDate || undefined,
      endDate,
      branchId: branchId || undefined,
      view: view || undefined,
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
        <div className="ml-auto">
          <ExportButton
            endpoint="/reports/general-ledger/export"
            params={{
              accountId: accountId || undefined,
              startDate: startDate || undefined,
              endDate,
              branchId: branchId || undefined,
              view: view || undefined,
            }}
            fallbackFilename={`general-ledger-${startDate}-to-${endDate}.xlsx`}
          />
        </div>
      </div>

      {drilled && (branchId || view) && (
        <p className="mb-3 text-xs text-gray-500">
          Scoped like the report you came from:
          {branchId && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
              One branch
            </span>
          )}
          {view && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              Internal (Unadjusted)
            </span>
          )}
        </p>
      )}

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
                ? [
                    'Date',
                    'Reference',
                    'Account',
                    'Description',
                    'Source',
                    'Debit',
                    'Credit',
                    'Balance',
                  ]
                : ['Date', 'Reference', 'Account', 'Description', 'Source', 'Debit', 'Credit']
            }
          >
            {rows.map((t: any) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-xs">{fmtDate(t.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {t.journalEntryId ? (
                    <Link
                      href={`/accounting/journal-entries/${t.journalEntryId}`}
                      className="text-purple-700 hover:underline"
                      title="Open journal entry"
                    >
                      {t.reference || 'View entry'}
                    </Link>
                  ) : (
                    t.reference || '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  {t.account?.number} {t.account?.name}
                </td>
                <td className="px-3 py-2 text-gray-500">{t.description || '—'}</td>
                <td className="px-3 py-2 text-xs">
                  <SourceCell line={t} />
                </td>
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

function SourceCell({ line }: { line: any }) {
  const link = sourceDocumentLink({
    sourceModule: line.sourceModule,
    sourceDocumentId: line.sourceDocumentId,
    sourceDocumentNo: line.sourceDocumentNo,
    code: line.reference,
    description: line.journalDescription,
  })
  const label = line.sourceDocumentNo || line.sourceModule || '—'
  if (!link) return <span className="text-gray-500">{label}</span>
  return (
    <Link href={link.href} className="text-purple-700 hover:underline" title={`Open ${link.kind}`}>
      {label}
    </Link>
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
