'use client'

import { useState } from 'react'
import { Layers, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { useBatchManager } from '../_hooks/useBatchManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  BATCH_STATUS_LABELS,
  BATCH_STATUS_COLORS,
  BatchStatusSchema,
  getExpiryStatus,
  EXPIRY_STATUS_COLORS,
  EXPIRY_STATUS_LABELS,
  type BatchStatus,
} from '@/src/schema/inventory/batches'
import CreateBatchModal from './CreateBatchModal'
import BatchDetailDrawer from './BatchDetailDrawer'

const statusOptions = BatchStatusSchema.options

export default function BatchList({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.BATCH_MANAGE)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const {
    batches,
    expiringBatches,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    itemFilter,
    search,
    setStatusFilter,
    setItemFilter,
    setSearch,
    resetFilters,
    page,
    setPage,
    selectedBatch,
    setSelectedBatch,
    itemOptions,
    createBatch,
    isCreating,
    updateStatus,
    isUpdatingStatus,
    placeHold,
    isPlacingHold,
    releaseHold,
    isReleasingHold,
    refetch,
  } = useBatchManager()

  const hasFilters = statusFilter || itemFilter || search

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Batch / Lot Tracking</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage batches, track expiry, and apply quality holds.
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
            {canManage && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Layers className="h-4 w-4" />
                New Batch
              </button>
            )}
          </div>
        </div>

        {/* Expiry alerts banner */}
        {expiringBatches.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {expiringBatches.length} batch{expiringBatches.length !== 1 ? 'es' : ''} expiring
                within 30 days
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                {expiringBatches.map((b) => b.batchNumber).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search ?? ''}
            onChange={(e) => setSearch(e.target.value || undefined)}
            placeholder="Search batch numbers…"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 min-w-[200px]"
          />
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as BatchStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {BATCH_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={itemFilter ?? ''}
            onChange={(e) => setItemFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Items</option>
            {itemOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku} — {item.name}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load batches</p>
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
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Layers className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No batches found</p>
              {canManage && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create your first batch to enable lot-level tracking.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Batch #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Expiry
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Expiry Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {batches.map((batch) => {
                    const expiryStatus = getExpiryStatus(batch.expiryDate)
                    return (
                      <tr key={batch.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-zinc-700">
                          {batch.batchNumber}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{batch.item?.name ?? '—'}</p>
                          {batch.item?.sku && (
                            <p className="font-mono text-xs text-zinc-400">{batch.item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${BATCH_STATUS_COLORS[batch.status]}`}
                          >
                            {BATCH_STATUS_LABELS[batch.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-600 hidden md:table-cell">
                          {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          {batch.expiryDate ? (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${EXPIRY_STATUS_COLORS[expiryStatus]}`}
                            >
                              {EXPIRY_STATUS_LABELS[expiryStatus]}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">No expiry</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedBatch(batch)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
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

      <CreateBatchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createBatch}
        isSubmitting={isCreating}
        items={itemOptions}
      />

      <BatchDetailDrawer
        batch={selectedBatch}
        onClose={() => setSelectedBatch(null)}
        onUpdateStatus={updateStatus}
        onPlaceHold={placeHold}
        onReleaseHold={releaseHold}
        isUpdatingStatus={isUpdatingStatus}
        isPlacingHold={isPlacingHold}
        isReleasingHold={isReleasingHold}
      />
    </div>
  )
}
