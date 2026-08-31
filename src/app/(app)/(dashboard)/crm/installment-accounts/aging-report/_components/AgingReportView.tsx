'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { installmentAccountsApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../../_actions/get-branches'
import { printAgingReportDocument } from '@/src/libs/print/printInventoryDocument'
import type { AgingReportResponse } from '@/src/schema/crm/types'

function fmt(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AgingReportView() {
  const [report, setReport] = useState<AgingReportResponse | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [asOf, setAsOf] = useState(todayIso())
  const [branchFilter, setBranchFilter] = useState('')
  const [collectorFilter, setCollectorFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
    collectorsApi.list({ limit: 200 }).then((res) => {
      if (res.success && res.data) setCollectors(res.data.data)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    installmentAccountsApi
      .agingReport({
        asOf: asOf || undefined,
        branchId: branchFilter || undefined,
        collectorId: collectorFilter || undefined,
      })
      .then((res) => {
        if (controller.signal.aborted) return
        if (res.success && res.data) setReport(res.data)
        else setError(res.error ?? 'Failed to load the aging report')
        setLoading(false)
      })
    return () => controller.abort()
  }, [asOf, branchFilter, collectorFilter])

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">AR Aging Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Active installment accounts, grouped by branch and collector.
          </p>
        </div>
        <button
          onClick={() => report && printAgingReportDocument(report)}
          disabled={!report}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          As of
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={collectorFilter}
          onChange={(e) => setCollectorFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All collectors</option>
          {collectors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.stubNumber} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !report || report.branches.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
          No active accounts to show.
        </p>
      ) : (
        <div className="space-y-6">
          {report.branches.map((branch) => (
            <div
              key={branch.branchId ?? 'unassigned'}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="flex items-center justify-between bg-gray-100 px-4 py-2">
                <h2 className="text-sm font-semibold uppercase text-gray-700">
                  {branch.branchName}
                </h2>
                <span className="text-xs text-gray-500">
                  {branch.subtotal.count} account{branch.subtotal.count !== 1 ? 's' : ''} · OB{' '}
                  {fmt(branch.subtotal.ob)}
                </span>
              </div>
              {branch.collectors.map((collector) => (
                <div
                  key={collector.collectorId ?? 'unassigned'}
                  className="border-t border-gray-100"
                >
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-1.5">
                    <span className="text-xs font-medium text-gray-600">
                      Collector: {collector.collectorLabel}
                    </span>
                    <span className="text-xs text-gray-500">
                      {collector.subtotal.count} · TOTAL PAY&apos;T{' '}
                      {fmt(collector.subtotal.totalPayt)} · OB {fmt(collector.subtotal.ob)}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1400px] text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-[11px] uppercase text-gray-500">
                          <th className="px-2 py-1.5">Account</th>
                          <th className="px-2 py-1.5">Customer</th>
                          <th className="px-2 py-1.5">Type</th>
                          <th className="px-2 py-1.5 text-right">Term</th>
                          <th className="px-2 py-1.5 text-right">MI</th>
                          <th className="px-2 py-1.5 text-right">DP Bal</th>
                          <th className="px-2 py-1.5 text-right">OB</th>
                          <th className="px-2 py-1.5 text-right">MI DUE</th>
                          <th className="px-2 py-1.5 text-right">NO ARS</th>
                          <th className="px-2 py-1.5 text-right">MOS RUN</th>
                          <th className="px-2 py-1.5 text-right">NOT MVG</th>
                          <th className="px-2 py-1.5 text-right">TOTAL PAY&apos;T</th>
                          <th className="px-2 py-1.5 text-right">TOTAL PRICE</th>
                          <th className="px-2 py-1.5">Last OR Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collector.rows.map((row) => (
                          <tr key={row.accountId} className="border-b border-gray-100">
                            <td className="px-2 py-1.5 font-mono">{row.accountNumber}</td>
                            <td className="px-2 py-1.5">{row.customerName}</td>
                            <td className="px-2 py-1.5">{row.type ?? '—'}</td>
                            <td className="px-2 py-1.5 text-right">{row.term ?? '—'}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.mi)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.dpBal)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.ob)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.miDue)}</td>
                            <td className="px-2 py-1.5 text-right">
                              {row.noArs === null ? '—' : row.noArs}
                            </td>
                            <td className="px-2 py-1.5 text-right">{row.mosRun}</td>
                            <td className="px-2 py-1.5 text-right">{row.notMvg}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.totalPayt)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.totalPrice)}</td>
                            <td className="px-2 py-1.5">{row.lastOrDate ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
            Grand Total ({report.grandTotal.count} accounts): TOTAL PAY&apos;T{' '}
            {fmt(report.grandTotal.totalPayt)} · TOTAL PRICE {fmt(report.grandTotal.totalPrice)} ·
            OB {fmt(report.grandTotal.ob)}
          </div>
        </div>
      )}
    </div>
  )
}
