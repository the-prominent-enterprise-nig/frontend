'use client'

import { Download, TrendingDown, BarChart2, AlertTriangle, X } from 'lucide-react'
import type { TurnoverReportResponse, TurnoverReportItem } from '@/src/schema/inventory/reports'

interface Props {
  data: TurnoverReportResponse | null | undefined
  isLoading: boolean
  isFetching: boolean
  periodDays: number
  setPeriodDays: (v: number) => void
  statusFilter: 'healthy' | 'slow_moving' | 'dead_stock' | undefined
  setStatusFilter: (v: 'healthy' | 'slow_moving' | 'dead_stock' | undefined) => void
  page: number
  setPage: (page: number) => void
}

const STATUS_CONFIG = {
  healthy: { label: 'Healthy', color: 'bg-green-100 text-green-700' },
  slow_moving: { label: 'Slow Moving', color: 'bg-orange-100 text-orange-700' },
  dead_stock: { label: 'Dead Stock', color: 'bg-red-100 text-red-700' },
}

const AGING_COLORS: Record<string, string> = {
  '0-30': 'bg-green-100 text-green-700',
  '31-60': 'bg-yellow-100 text-yellow-700',
  '61-90': 'bg-orange-100 text-orange-700',
  '90+': 'bg-red-100 text-red-700',
}

function exportToCsv(data: TurnoverReportResponse) {
  const headers = [
    'Item Name',
    'SKU',
    'Category',
    'On-Hand Qty',
    'Qty Sold',
    'Velocity (units/day)',
    'Days of Stock',
    'Last Sale',
    'Aging Bucket',
    'Status',
  ]
  const rows = data.data.map((item) => [
    item.itemName,
    item.sku,
    item.category ?? '',
    item.onHandQty,
    item.qtySold,
    item.salesVelocityPerDay.toFixed(2),
    item.daysOfStock ?? 'N/A',
    item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString('en-PH') : 'Never',
    item.agingBucket ?? 'N/A',
    item.status,
  ])

  const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stock-turnover-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function TurnoverReport({
  data,
  isLoading,
  isFetching,
  periodDays,
  setPeriodDays,
  statusFilter,
  setStatusFilter,
  page,
  setPage,
}: Props) {
  const summary = data?.summary
  const meta = data?.meta
  const totalPages = meta?.lastPage ?? 1
  const totalRows = meta?.total ?? 0
  const pageSize = meta?.limit ?? 20

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="turnover-period" className="text-sm font-medium text-zinc-600">
            Period:
          </label>
          <select
            id="turnover-period"
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        </div>

        <label htmlFor="turnover-status-filter" className="sr-only">
          Filter by status
        </label>
        <select
          id="turnover-status-filter"
          aria-label="Filter by status"
          value={statusFilter ?? ''}
          onChange={(e) => setStatusFilter((e.target.value || undefined) as typeof statusFilter)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        >
          <option value="">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="slow_moving">Slow Moving</option>
          <option value="dead_stock">Dead Stock</option>
        </select>

        {statusFilter && (
          <button
            type="button"
            onClick={() => setStatusFilter(undefined)}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {/* Aging Summary Cards */}
      {!isLoading && summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['0-30', '31-60', '61-90', '90+'] as const).map((bucket) => (
            <div key={bucket} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${AGING_COLORS[bucket]}`}
                >
                  {bucket} days
                </span>
                <BarChart2 className="h-4 w-4 text-zinc-300" />
              </div>
              <p className="mt-3 text-2xl font-bold text-zinc-800">
                {summary.agingBreakdown[bucket]}
              </p>
              <p className="text-xs text-zinc-500">items</p>
            </div>
          ))}
        </div>
      )}

      {/* Alert banners */}
      {!isLoading && summary && (summary.slowMoving > 0 || summary.deadStock > 0) && (
        <div className="flex flex-wrap gap-3">
          {summary.slowMoving > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-700">
                {summary.slowMoving} slow-moving item{summary.slowMoving !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {summary.deadStock > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">
                {summary.deadStock} dead stock item{summary.deadStock !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Turnover and aging calculated over the last {periodDays} days.
        </p>
        {(data?.data?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => data && exportToCsv(data)}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16">
            <BarChart2 className="mb-3 h-10 w-10 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">No turnover data available</p>
            <p className="mt-1 text-xs text-zinc-400">
              Sales activity over the selected period will populate this report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Item
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    On-Hand
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Sold
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                    Velocity/day
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Aging
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.data.map((item: TurnoverReportItem) => {
                  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.healthy
                  return (
                    <tr key={item.itemId} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-800">{item.itemName}</p>
                        <p className="mt-0.5 text-xs font-mono text-zinc-400">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-700 hidden sm:table-cell">
                        {item.onHandQty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 hidden md:table-cell">
                        {item.qtySold.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 hidden lg:table-cell">
                        {item.salesVelocityPerDay.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.agingBucket ? (
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${AGING_COLORS[item.agingBucket] ?? 'bg-zinc-100 text-zinc-600'}`}
                          >
                            {item.agingBucket}d
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} of {totalRows}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-medium text-zinc-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
