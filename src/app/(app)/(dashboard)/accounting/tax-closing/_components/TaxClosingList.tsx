'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw } from 'lucide-react'
import {
  TaxClosing,
  type SettlementStatus,
  type SettlementType,
  type TaxSettlement,
} from '@/src/libs/data/TaxReportsData'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { SETTLEMENT_TYPE_LABEL } from '@/src/libs/tax/tax-reports'

// Scenario 69 Part H — the tax closing routines. A VAT settlement clears Output
// and Input VAT into VAT Payable; a remittance pays the withholding tax owed
// out of a bank. Each is a journal entry posted from a screen, kept as a run
// that can be reversed — not a manual entry.
export default function TaxClosingList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<TaxSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<SettlementType | ''>('')
  const [status, setStatus] = useState<SettlementStatus | ''>('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await TaxClosing.list({ type: type || undefined, status: status || undefined })
    if (res.success) {
      setItems(res.data ?? [])
      setError(null)
    } else {
      setError(res.message || res.error || 'Could not load the runs')
    }
    setLoading(false)
  }, [type, status])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const lastLive = (t: SettlementType) => items.find((i) => i.type === t && i.status === 'POSTED')

  return (
    <div className="px-6 py-6 lg:px-10">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-prominent-purple-900">Tax Closing</h1>
          <p className="mt-1 text-sm text-gray-500">
            The VAT settlement and the withholding tax remittance. Each posts a journal entry from a
            screen that shows it first, and can be reversed. Balances are cleared through a day, so
            an entry dated in an earlier month but posted late is picked up by the next run.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {canCreate && (
            <>
              <Link
                href="/accounting/tax-closing/wht/new"
                data-testid="new-wht"
                className="flex items-center gap-2 rounded-lg border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
              >
                <Plus className="h-4 w-4" /> Remit withholding tax
              </Link>
              <Link
                href="/accounting/tax-closing/vat/new"
                data-testid="new-vat"
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
              >
                <Plus className="h-4 w-4" /> Settle VAT
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {(['VAT_SETTLEMENT', 'WHT_REMITTANCE'] as const).map((t) => {
          const last = lastLive(t)
          return (
            <div
              key={t}
              data-testid={`last-${t}`}
              className="rounded-lg border border-purple-100 bg-white px-4 py-3"
            >
              <div className="text-xs font-medium text-gray-500">{SETTLEMENT_TYPE_LABEL[t]}</div>
              <div className="mt-1 text-sm">
                {last ? (
                  <>
                    Through <b>{last.asOfDate}</b> · {last.settlementNumber}
                  </>
                ) : (
                  <span className="text-gray-500">None in force yet</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Run</span>
          <select
            aria-label="Run type"
            value={type}
            onChange={(e) => setType(e.target.value as SettlementType | '')}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="VAT_SETTLEMENT">VAT settlement</option>
            <option value="WHT_REMITTANCE">Withholding tax remittance</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Status</span>
          <select
            aria-label="Run status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SettlementStatus | '')}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="POSTED">In force</option>
            <option value="REVERSED">Reversed</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div
        data-testid="closing-table"
        className="overflow-x-auto rounded-lg border border-gray-200 bg-white"
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Run</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Through</th>
              <th className="px-3 py-2 text-left">Posted on</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Paid from / reference</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">By</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  {loading ? 'Loading...' : 'No runs yet.'}
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr
                  key={r.id}
                  data-testid="closing-row"
                  onClick={() => router.push(`/accounting/tax-closing/${r.id}`)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-purple-50/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-purple-700">
                    {r.settlementNumber}
                  </td>
                  <td className="px-3 py-2">{SETTLEMENT_TYPE_LABEL[r.type]}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.asOfDate}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.postingDate}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.type === 'VAT_SETTLEMENT' ? (
                      <>
                        {fmtMoney(Math.abs(r.netAmount))}
                        <div className="text-[11px] text-gray-500">
                          {r.netAmount >= 0 ? 'payable' : 'creditable'}
                        </div>
                      </>
                    ) : (
                      fmtMoney(r.netAmount)
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.bankName ?? '—'}
                    {r.reference && <div className="text-[11px] text-gray-500">{r.reference}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {r.status === 'POSTED' ? (
                      <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                        In force
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                        Reversed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.createdByName ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
