'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { installmentAccountsApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../../_actions/get-branches'
import { printAgingReportDocument } from '@/src/libs/print/printInventoryDocument'
import ExportButton from '@/src/components/common/ExportButton'
import TablePagination from '@/src/components/common/TablePagination'
import {
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  type AgingBucket,
  type AgingReportResponse,
} from '@/src/schema/crm/types'

// Same badge convention the inventory aging report already uses, extended
// with a neutral tone for a row whose due date isn't on record.
/** Branch sections per page. Matches the sales report's page size. */
const BRANCHES_PER_PAGE = 10

const BUCKET_STYLES: Record<AgingBucket, string> = {
  current: 'bg-green-100 text-green-700',
  '1_30': 'bg-yellow-100 text-yellow-700',
  '31_60': 'bg-orange-100 text-orange-700',
  '61_90': 'bg-red-100 text-red-700',
  '90_plus': 'bg-red-200 text-red-800',
}

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
  const [page, setPage] = useState(1)
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
    // A new result set invalidates the current page.
    setPage(1)
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

  // Term/MI/DP/MI-DUE only ever have values on installment rows. When the
  // current filter returns none, those five columns are dashes on every row —
  // so drop them rather than spending a third of the table on nothing.
  // Branch sections are the unit here, not rows — each carries its own
  // collector tables, so paging rows would fragment a branch across pages.
  const allBranches = report?.branches ?? []
  const pageCount = Math.max(1, Math.ceil(allBranches.length / BRANCHES_PER_PAGE))
  const safePage = Math.min(page, pageCount)
  const pageStart = (safePage - 1) * BRANCHES_PER_PAGE
  const pagedBranches = allBranches.slice(pageStart, pageStart + BRANCHES_PER_PAGE)

  const hasInstallmentRows = Boolean(
    report?.branches.some((b) =>
      b.collectors.some((c) => c.rows.some((r) => r.source === 'installment'))
    )
  )

  return (
    <div className="px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">AR Aging Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Outstanding receivables — active installment accounts and standalone AR invoices —
            grouped by branch and collector.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint="/crm/installment-accounts/reports/aging/export"
            params={{
              asOf: asOf || undefined,
              branchId: branchFilter || undefined,
              collectorId: collectorFilter || undefined,
            }}
            disabled={!report || report.branches.length === 0}
          />
          <button
            onClick={() => report && printAgingReportDocument(report)}
            disabled={!report}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
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
          {/* Scenario 47 — branch x aging bucket. The per-branch detail
              tables below are unchanged; this is the management summary. */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Branch</th>
                  <th className="px-4 py-2 text-right font-semibold">Accounts</th>
                  {AGING_BUCKETS.map((b) => (
                    <th key={b} className="px-4 py-2 text-right font-semibold">
                      {AGING_BUCKET_LABELS[b]}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-semibold">Unknown</th>
                  <th className="px-4 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.branches.map((branch) => (
                  <tr key={branch.branchId ?? 'unassigned'} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{branch.branchName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{branch.subtotal.count}</td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b} className="px-4 py-2 text-right tabular-nums">
                        {fmt(branch.subtotal.buckets[b])}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                      {fmt(branch.subtotal.buckets.unknown)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {fmt(branch.subtotal.ob)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2">TOTAL</td>
                  <td className="px-4 py-2 text-right tabular-nums">{report.grandTotal.count}</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b} className="px-4 py-2 text-right tabular-nums">
                      {fmt(report.grandTotal.buckets[b])}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmt(report.grandTotal.buckets.unknown)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(report.grandTotal.ob)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {pagedBranches.map((branch) => (
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
                    <table className="w-full min-w-[1180px] text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-[11px] uppercase text-gray-500">
                          <th className="px-1.5 py-1.5 whitespace-nowrap">Account</th>
                          <th className="px-1.5 py-1.5 whitespace-nowrap">Customer</th>
                          <th className="px-1.5 py-1.5 whitespace-nowrap">Source</th>
                          <th className="px-1.5 py-1.5 whitespace-nowrap">Aging</th>
                          {hasInstallmentRows && (
                            <>
                              <th className="px-1.5 py-1.5 whitespace-nowrap">Type</th>
                              <th className="px-1.5 py-1.5 text-right whitespace-nowrap">Term</th>
                              <th className="px-1.5 py-1.5 text-right whitespace-nowrap">MI</th>
                              <th className="px-1.5 py-1.5 text-right whitespace-nowrap">DP Bal</th>
                            </>
                          )}
                          <th className="px-1.5 py-1.5 text-right whitespace-nowrap">OB</th>
                          {hasInstallmentRows && (
                            <th className="px-1.5 py-1.5 text-right whitespace-nowrap">MI DUE</th>
                          )}
                          <th className="px-1.5 py-1.5 text-right whitespace-nowrap">NO ARS</th>
                          <th className="px-1.5 py-1.5 text-right whitespace-nowrap">MOS RUN</th>
                          <th className="px-1.5 py-1.5 text-right whitespace-nowrap">NOT MVG</th>
                          <th className="px-1.5 py-1.5 text-right whitespace-nowrap">
                            TOTAL PAY&apos;T
                          </th>
                          <th className="px-1.5 py-1.5 text-right whitespace-nowrap">
                            TOTAL PRICE
                          </th>
                          <th className="px-1.5 py-1.5 whitespace-nowrap">Last CR Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collector.rows.map((row) => (
                          <tr key={row.accountId} className="border-b border-gray-100">
                            <td className="px-1.5 py-1.5 font-mono">{row.accountNumber}</td>
                            <td className="px-1.5 py-1.5">{row.customerName}</td>
                            <td className="px-1.5 py-1.5 text-gray-500">
                              {row.source === 'installment' ? 'Installment' : 'Invoice'}
                            </td>
                            <td className="px-1.5 py-1.5 whitespace-nowrap">
                              {row.bucket ? (
                                <>
                                  <span
                                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${BUCKET_STYLES[row.bucket]}`}
                                  >
                                    {AGING_BUCKET_LABELS[row.bucket]}
                                  </span>
                                  {row.daysOverdue !== null && row.daysOverdue > 0 && (
                                    <span className="ml-1.5 text-gray-500">{row.daysOverdue}d</span>
                                  )}
                                </>
                              ) : (
                                // No due date on record — shown as unknown rather
                                // than quietly rendered as current.
                                <span className="text-gray-400">Unknown</span>
                              )}
                            </td>
                            {hasInstallmentRows && (
                              <>
                                <td className="px-1.5 py-1.5">{row.type ?? '—'}</td>
                                <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                                  {row.term ?? '—'}
                                </td>
                                <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                                  {fmt(row.mi)}
                                </td>
                                <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                                  {fmt(row.dpBal)}
                                </td>
                              </>
                            )}
                            <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {fmt(row.ob)}
                            </td>
                            {hasInstallmentRows && (
                              <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {fmt(row.miDue)}
                              </td>
                            )}
                            <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {row.noArs === null ? '—' : row.noArs}
                            </td>
                            <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {row.mosRun}
                            </td>
                            <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {row.notMvg}
                            </td>
                            <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {fmt(row.totalPayt)}
                            </td>
                            <td className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {fmt(row.totalPrice)}
                            </td>
                            <td className="px-1.5 py-1.5">{row.lastOrDate ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <TablePagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
            pageStart={pageStart}
            pageSize={pagedBranches.length}
            totalItems={allBranches.length}
            noun="branch"
          />

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
