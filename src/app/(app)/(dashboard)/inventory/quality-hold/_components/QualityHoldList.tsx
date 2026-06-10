'use client'

import { useState } from 'react'
import { Plus, RefreshCw, X, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useQualityHoldManager } from '../_hooks/useQualityHoldManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import PlaceOnHoldModal from './PlaceOnHoldModal'
import ReleaseHoldModal from './ReleaseHoldModal'

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function QualityHoldList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.QUALITY_HOLD_MANAGE)

  const {
    holds,
    pagination,
    isLoading,
    isFetching,
    error,
    itemFilter,
    setItemFilter,
    page,
    setPage,
    selectedBatch,
    setSelectedBatch,
    itemOptions,
    warehouseOptions,
    placeOnHold,
    isPlacingHold,
    releaseHold,
    isReleasingHold,
    refetch,
  } = useQualityHoldManager()

  const [isPlaceOpen, setIsPlaceOpen] = useState(false)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Quality Hold</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Batches under inspection — not available for sale or transfer until released by an
              inspector.
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
                onClick={() => setIsPlaceOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                <Plus className="h-4 w-4" />
                Place on Hold
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={itemFilter ?? ''}
            onChange={(e) => setItemFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Items</option>
            {itemOptions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.sku})
              </option>
            ))}
          </select>
          {itemFilter && (
            <button
              type="button"
              onClick={() => setItemFilter(undefined)}
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
            <p className="text-sm font-medium text-red-800">Failed to load quality holds</p>
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
                  <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-24 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : holds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ShieldCheck className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No batches on quality hold</p>
              <p className="mt-1 text-xs text-zinc-400">
                All received stock has passed inspection.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Batch / Lot
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      GR / PO Ref
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Expiry
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Placed On Hold
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {holds.map((batch) => (
                    <tr key={batch.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                          <span className="font-mono text-sm font-medium text-zinc-800">
                            {batch.batchNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {batch.item ? (
                          <>
                            <p className="font-medium text-zinc-900">{batch.item.name}</p>
                            <p className="font-mono text-xs text-zinc-400">{batch.item.sku}</p>
                          </>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {batch.receivedViaGrId ? (
                          <span className="font-mono text-xs text-zinc-600">
                            {batch.receivedViaGrId}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">
                        {formatDate(batch.expiryDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 hidden lg:table-cell">
                        {formatDate(batch.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canCreate && (
                          <button
                            type="button"
                            onClick={() => setSelectedBatch(batch)}
                            className="rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800"
                          >
                            Inspect
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} holds
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

      <PlaceOnHoldModal
        isOpen={isPlaceOpen}
        onClose={() => setIsPlaceOpen(false)}
        onSubmit={(data) => placeOnHold(data)}
        isSubmitting={isPlacingHold}
        itemOptions={itemOptions}
      />

      <ReleaseHoldModal
        isOpen={!!selectedBatch}
        batch={selectedBatch}
        onClose={() => setSelectedBatch(null)}
        onSubmit={releaseHold}
        isSubmitting={isReleasingHold}
        warehouseOptions={warehouseOptions}
      />
    </div>
  )
}
