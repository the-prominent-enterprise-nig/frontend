'use client'

import { RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useProjection, DAY_OPTIONS } from '../_hooks/useProjection'
import type { DayOption } from '../_hooks/useProjection'

function projectedAvailableColor(qty: number): string {
  if (qty <= 0) return 'text-red-600 font-semibold'
  if (qty < 10) return 'text-amber-600 font-semibold'
  return 'text-green-600'
}

function formatDate(iso?: string): string {
  if (!iso) return 'N/A'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function ProjectionPageView({ session: _session }: { session: SessionUser }) {
  const { projectionItems, stockoutAlerts, isLoading, isFetching, days, setDays, refetch } =
    useProjection()

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Projection</h1>
            <p className="mt-1 text-sm text-zinc-500">
              View forward stock projections based on demand and supply schedules.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Stat chips */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
            <TrendingUp className="h-4 w-4 text-prominent-purple-600" />
            <span className="text-sm text-zinc-500">Items Projected:</span>
            <span className="text-sm font-semibold text-zinc-900">{projectionItems.length}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 shadow-sm">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">Stockout Risk:</span>
            <span className="text-sm font-semibold text-red-800">{stockoutAlerts.length}</span>
          </div>
        </div>

        {/* Days horizon segmented control */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-600">Days Horizon:</span>
          <div className="flex rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-sm">
            {DAY_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setDays(opt as DayOption)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === opt
                    ? 'bg-prominent-purple-700 text-white'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {opt}d
              </button>
            ))}
          </div>
        </div>

        {/* Stockout Alerts */}
        {stockoutAlerts.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-sm font-semibold text-red-800">
                Stockout Alerts ({stockoutAlerts.length})
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {stockoutAlerts.map((alert, idx) => {
                const days = alert.stockoutDate
                  ? Math.ceil((new Date(alert.stockoutDate).getTime() - Date.now()) / 86_400_000)
                  : null
                return (
                  <div
                    key={`${alert.itemId}-${alert.warehouseId ?? idx}`}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <span className="text-sm font-medium text-zinc-900">
                      {alert.name ?? alert.itemId}
                    </span>
                    {alert.warehouseName && (
                      <span className="text-xs text-zinc-400">@ {alert.warehouseName}</span>
                    )}
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {days != null
                        ? `Stockout in ${days} day${days === 1 ? '' : 's'}`
                        : 'Stockout risk'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Projection table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
            isFetching ? 'opacity-60' : ''
          }`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading projection data…</div>
          ) : projectionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <TrendingUp className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No projection data available</p>
              <p className="mt-1 text-xs text-zinc-400">
                Adjust filters or check that items have supply/demand data.
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
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell">
                      SKU
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      On Hand
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">
                      Incoming
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">
                      Reserved
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Min Projected Bal.
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                      Stockout Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {projectionItems.map((item, idx) => {
                    const totalIncoming = item.dailyProjections.reduce(
                      (sum, d) => sum + d.incomingQty,
                      0
                    )
                    return (
                      <tr
                        key={`${item.itemId}-${item.warehouseId ?? idx}`}
                        className="hover:bg-zinc-50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{item.name ?? item.itemId}</p>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                            {item.sku ?? '—'}
                          </code>
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                          {item.warehouseName ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700">{item.startQty}</td>
                        <td className="hidden px-4 py-3 text-right text-zinc-700 lg:table-cell">
                          {totalIncoming}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-zinc-700 lg:table-cell">
                          {item.activeReservations}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${projectedAvailableColor(item.projectedMinBalance)}`}
                        >
                          {item.projectedMinBalance}
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                          {item.stockoutDate ? (
                            <span className="text-red-600">{formatDate(item.stockoutDate)}</span>
                          ) : (
                            <span className="text-zinc-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
