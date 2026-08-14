'use client'

import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw,
  Search,
  AlertTriangle,
  Package,
  X,
  Filter,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useStockBalance } from '../_hooks/useStockBalance'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import type { SessionUser } from '@/src/libs/guards/permission'

function SerialsPanel({ itemId, warehouseId }: { itemId?: string; warehouseId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-stock-balance-serials', itemId, warehouseId],
    queryFn: () => getSerialNumbers({ itemId, warehouseId, status: 'in_stock', limit: 200 }),
    enabled: !!itemId && !!warehouseId,
    staleTime: 30 * 1000,
  })

  const serials = data?.data?.data ?? []

  if (isLoading) return <p className="text-xs text-zinc-400">Loading serial numbers…</p>
  if (serials.length === 0)
    return (
      <p className="text-xs text-zinc-400">No individual serial numbers on file for this item.</p>
    )
  return (
    <div className="flex flex-wrap gap-1.5">
      {serials.map((s) => (
        <span
          key={s.id}
          className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-mono text-xs text-zinc-700"
        >
          {s.serialNumber}
        </span>
      ))}
    </div>
  )
}

export default function StockBalanceList({ session: _session }: { session: SessionUser }) {
  const {
    balances,
    pagination,
    isLoading,
    isFetching,
    error,
    warehouseFilter,
    search,
    belowReorder,
    setWarehouseFilter,
    setSearch,
    setBelowReorder,
    resetFilters,
    page,
    setPage,
    limit,
    setLimit,
    warehouseOptions,
    refetch,
  } = useStockBalance()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasFilters = !!warehouseFilter || !!search || belowReorder

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Balance</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Real-time view of on-hand, reserved, and available quantities across all branches.
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search item name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-prominent-purple-500"
            />
          </div>

          {/* Warehouse filter */}
          <select
            value={warehouseFilter ?? ''}
            onChange={(e) => setWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Branches</option>
            {warehouseOptions.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.branch?.name ?? wh.name}
              </option>
            ))}
          </select>

          {/* Below reorder toggle */}
          <button
            type="button"
            onClick={() => setBelowReorder(!belowReorder)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              belowReorder
                ? 'border-orange-300 bg-orange-50 text-orange-700'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Below Reorder
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load stock balances</p>
          </div>
        )}

        {/* Summary chips */}
        {!isLoading && (
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm">
              <span className="text-zinc-500">Total items:</span>{' '}
              <span className="font-semibold text-zinc-800">{pagination.total}</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : balances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No stock records found</p>
              <p className="mt-1 text-xs text-zinc-400">
                {hasFilters
                  ? 'Try adjusting your filters.'
                  : 'Receive goods into inventory to see stock here.'}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      On-Hand
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Reserved
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Available
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Serials
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {balances.map((bal) => {
                    const isBelowReorder =
                      bal.reorderPoint != null && bal.availableQty < bal.reorderPoint
                    const isOutOfStock = bal.availableQty <= 0
                    const isExpanded = expandedIds.has(bal.id)

                    return (
                      <Fragment key={bal.id}>
                        <tr className="hover:bg-zinc-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-800">{bal.item?.name ?? '—'}</p>
                            <p className="mt-0.5 text-xs text-zinc-400 font-mono">
                              {bal.item?.sku}
                            </p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-zinc-600">{bal.warehouse?.name ?? '—'}</span>
                            {bal.warehouse?.code && (
                              <span className="ml-1.5 text-xs text-zinc-400">
                                ({bal.warehouse.code})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-zinc-700">
                            {bal.onHandQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-500 hidden sm:table-cell">
                            {bal.reservedQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-semibold ${
                                isOutOfStock
                                  ? 'text-red-600'
                                  : isBelowReorder
                                    ? 'text-orange-600'
                                    : 'text-green-700'
                              }`}
                            >
                              {bal.availableQty.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden lg:table-cell">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                Out of Stock
                              </span>
                            ) : isBelowReorder ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                                <AlertTriangle className="h-3 w-3" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(bal.id)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              View
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-zinc-50 px-4 py-3">
                              <SerialsPanel itemId={bal.item?.id} warehouseId={bal.warehouse?.id} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
            <div className="flex items-center gap-3">
              <span>
                Showing {(page - 1) * pagination.limit + 1}–
                {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} records
              </span>
              <label className="flex items-center gap-1.5">
                <span className="text-zinc-400">Per page</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-prominent-purple-500"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 font-medium text-zinc-700">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page >= pagination.totalPages}
                  className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
