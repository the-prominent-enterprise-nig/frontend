'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import ExportButton from '@/src/components/common/ExportButton'
import { getSalesFilterOptions, getSalesSummary } from '../_actions/get-sales-reports'
import { useSalesReportFilters, type SalesReportsTab } from '../_hooks/useSalesReportFilters'
import SalesReportFilters from './SalesReportFilters'
import SalesReportTab from './SalesReportTab'
import DashboardTab from './dashboard/DashboardTab'
import SalesStatCards from './SalesStatCards'

/**
 * Scenario 85 — Sales Reports: "Units and sales by model and brand, month by
 * month." One filter bar and one row of stat cards shared by three tabs.
 * Each tab's body arrives in its own part of the scenario (Sales Report in
 * Part 2, Dashboard in Part 3, Sales per Branch in Parts 5–6), and so does
 * the per-tab Export to Excel (Part 7).
 */

const TABS: { key: SalesReportsTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'branch', label: 'Sales per Branch' },
  { key: 'report', label: 'Sales Report' },
]

export default function SalesReportsView(): React.JSX.Element {
  const report = useSalesReportFilters()

  const options = useQuery({
    queryKey: ['pos-sales-report-filters'],
    queryFn: async () => {
      const res = await getSalesFilterOptions()
      return res.success ? res.data : undefined
    },
    staleTime: 5 * 60_000,
  })

  const summary = useQuery({
    queryKey: ['pos-sales-report-summary', report.apiParams],
    queryFn: async () => {
      const res = await getSalesSummary(report.apiParams)
      if (!res.success || !res.data) throw new Error(res.error ?? 'Could not load sales')
      return res.data
    },
    placeholderData: keepPreviousData,
  })

  return (
    <div className="flex flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Sales Reports</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Units and sales by model and brand, month by month.
          </p>
        </div>
        {/* Sales Report tab only until Part 7 gives every tab its own export. */}
        {report.filters.tab === 'report' && (
          <ExportButton
            endpoint="/pos/reports/sales/lines/export"
            params={report.apiParams}
            disabled={!summary.data?.lineCount}
          />
        )}
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sales report views">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={report.filters.tab === t.key}
            onClick={() => report.setTab(t.key)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              report.filters.tab === t.key
                ? 'border-prominent-purple-700 bg-prominent-purple-700 text-white'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <SalesReportFilters
        filters={report.filters}
        options={options.data}
        loading={options.isLoading}
        onRange={report.setRange}
        onFilter={report.setFilter}
        onRegion={report.setRegion}
        onClear={report.clearFilters}
        hasFilters={report.hasFilters}
      />

      {summary.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load sales for these filters. Try again, or widen the date range.
        </p>
      )}

      <SalesStatCards summary={summary.data} loading={summary.isLoading} />

      {report.filters.tab === 'report' ? (
        <SalesReportTab params={report.apiParams} />
      ) : report.filters.tab === 'dashboard' ? (
        <DashboardTab params={report.apiParams} />
      ) : (
        <section
          role="tabpanel"
          className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500"
        >
          {TABS.find((t) => t.key === report.filters.tab)?.label} is being rebuilt to the new
          layout.
        </section>
      )}
    </div>
  )
}
