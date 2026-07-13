'use client'

import { useState } from 'react'
import { Plus, RefreshCw, X, PackageCheck, AlertTriangle, RotateCcw } from 'lucide-react'
import { useReturnsManager } from '../_hooks/useReturnsManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import CreateReturnModal from './CreateReturnModal'

const CONDITION_CONFIG = {
  sellable: {
    label: 'Sellable',
    className: 'bg-green-100 text-green-700',
    icon: PackageCheck,
  },
  damaged: {
    label: 'Damaged',
    className: 'bg-orange-100 text-orange-700',
    icon: AlertTriangle,
  },
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ReturnList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.RETURNS_CREATE)

  const {
    returns,
    pagination,
    isLoading,
    isFetching,
    error,
    warehouseFilter,
    fromDate,
    toDate,
    setWarehouseFilter,
    setFromDate,
    setToDate,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    itemOptions,
    serialOptions,
    createReturn,
    isCreating,
    refetch,
  } = useReturnsManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const hasActiveFilters = !!(warehouseFilter || fromDate || toDate)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Returns</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Process returned items back into inventory. Sellable stock is immediately available;
              damaged stock goes to on-hand only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                Process Return
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={warehouseFilter ?? ''}
            onChange={(e) => setWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Warehouses</option>
            {warehouseOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate ?? ''}
            onChange={(e) => setFromDate(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            title="From date"
          />
          <input
            type="date"
            value={toDate ?? ''}
            onChange={(e) => setToDate(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            title="To date"
          />
          {hasActiveFilters && (
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
            <p className="text-sm font-medium text-red-800">Failed to load returns</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RotateCcw className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No returns found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Process a return to restock items and update inventory.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Condition
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {returns.map((ret) => {
                    const cond = ret.condition ? CONDITION_CONFIG[ret.condition] : null
                    return (
                      <tr key={ret.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                          {formatDate(ret.occurredAt ?? ret.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{ret.item?.name ?? '—'}</p>
                          <p className="font-mono text-xs text-zinc-400">{ret.item?.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                          {ret.warehouse?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-zinc-900">
                          {ret.quantity}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {cond ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cond.className}`}
                            >
                              <cond.icon className="h-3 w-3" />
                              {cond.label}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">
                          {ret.originalSaleId ? (
                            <span className="font-mono">{ret.originalSaleId}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500 hidden lg:table-cell max-w-xs truncate">
                          {ret.notes ?? '—'}
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
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} returns
            </span>
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
          </div>
        )}
      </div>

      <CreateReturnModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createReturn}
        isSubmitting={isCreating}
        itemOptions={itemOptions}
        warehouseOptions={warehouseOptions}
        serialOptions={serialOptions}
      />
    </div>
  )
}
