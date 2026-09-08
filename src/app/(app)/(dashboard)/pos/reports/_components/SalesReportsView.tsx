'use client'

import { useEffect, useState } from 'react'
import {
  getBranches,
  type BranchDetail,
} from '@/src/app/(app)/(dashboard)/settings/_actions/get-branches'
import { getBrands } from '@/src/app/(app)/(dashboard)/inventory/brands/_actions/get-brands'
import type { ItemClassification } from '@/src/schema/inventory/classification'
import ExportButton from '@/src/components/common/ExportButton'
import ReportDateRange from '@/src/components/common/ReportDateRange'
import { SUMMARY_KEY_HEADERS } from '@/src/schema/pos/reports'
import { useSalesReports, type SalesReportTab } from '../_hooks/useSalesReports'

const TABS: { key: SalesReportTab; label: string; blurb: string }[] = [
  {
    key: 'branch',
    label: 'Sales per Branch',
    blurb: 'Branch, then brand, category and model of unit.',
  },
  {
    key: 'brand',
    label: 'Sales per Brand',
    blurb: 'Brand, then category, model of unit and branch.',
  },
]

function money(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SalesReportsView(): React.JSX.Element {
  const report = useSalesReports()
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [brands, setBrands] = useState<ItemClassification[]>([])

  useEffect(() => {
    getBranches().then((r) => setBranches(r.success && r.data ? r.data : []))
    getBrands().then((r) => setBrands(r.success && r.data ? r.data : []))
  }, [])

  const totals = report.data?.meta.totals
  const keyHeaders = SUMMARY_KEY_HEADERS[report.data?.meta.groupBy ?? report.tab]

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            {TABS.find((t) => t.key === report.tab)?.blurb}
          </p>
        </div>
        <ExportButton
          endpoint={report.exportEndpoint}
          params={report.exportParams}
          disabled={!report.data || report.data.rows.length === 0}
        />
      </header>

      <div className="mb-4 flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={report.tab === t.key}
            onClick={() => report.setTab(t.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              report.tab === t.key
                ? 'bg-prominent-purple-700 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <ReportDateRange value={report.range} onChange={report.setRange} />

        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Branch
          <select
            aria-label="Branch"
            value={report.branchId}
            onChange={(e) => report.setBranchId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Brand
          <select
            aria-label="Brand"
            value={report.brandId}
            onChange={(e) => report.setBrandId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totals && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Net Sales" value={money(totals.net)} />
          <Stat label="Gross" value={money(totals.gross)} />
          <Stat label="Discounts" value={money(totals.discount)} />
          <Stat label="Margin" value={money(totals.margin)} />
          <Stat label="Refunds" value={money(totals.refunds)} />
          <Stat label="Units" value={String(totals.units)} />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {keyHeaders.map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Units</th>
              <th className="px-4 py-3 text-right font-semibold">Gross</th>
              <th className="px-4 py-3 text-right font-semibold">Discount</th>
              <th className="px-4 py-3 text-right font-semibold">Net Sales</th>
              <th className="px-4 py-3 text-right font-semibold">Margin</th>
              <th className="px-4 py-3 text-right font-semibold">Refunds</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.isLoading && (
              <tr>
                <td colSpan={keyHeaders.length + 6} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!report.isLoading && !report.data?.summary.length && (
              <tr>
                <td colSpan={keyHeaders.length + 6} className="px-4 py-8 text-center text-gray-500">
                  No sales in this date range.
                </td>
              </tr>
            )}
            {report.data?.summary.map((row) => (
              <tr key={row.keys.join('|')} className="hover:bg-gray-50">
                {row.keys.map((k, i) => (
                  <td key={i} className="px-4 py-3 text-gray-900">
                    {k}
                  </td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums">{row.units}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(row.gross)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(row.discount)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {money(row.net)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(row.margin)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(row.refunds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.data && (
        <p className="mt-3 text-xs text-gray-500">
          {report.data.meta.rowCount} detail row(s) behind this summary — the Excel export includes
          every one, with model number and serial per line.
          {report.data.meta.deliveryFees > 0 &&
            ` Delivery fees of ${money(report.data.meta.deliveryFees)} are charged per transaction and are not part of the per-item figures above.`}
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">{value}</div>
    </div>
  )
}
