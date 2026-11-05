'use client'

import { useState } from 'react'
import { RefreshCw, X, ClipboardList } from 'lucide-react'
import { useStockCounts, isDue } from '../_hooks/useStockCounts'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  COUNT_TYPE_LABELS,
  COUNT_STATUS_LABELS,
  CountStatusSchema,
  type CountStatus,
  type CountSummary,
} from '@/src/schema/inventory/stock-counts'
import CreateCountModal from './CreateCountModal'
import CountSessionView from './CountSessionView'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import PrintPhysicalInventoryButton from './PrintPhysicalInventoryButton'
import { formatManilaDate } from '@/src/libs/format/manila-date'

const STATUS_COLORS: Record<CountStatus, string> = {
  scheduled: 'bg-zinc-100 text-zinc-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default function StockCountList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_COUNT_CREATE)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const {
    counts,
    pagination,
    isLoading,
    isFetching,
    error,
    warehouseFilter,
    countTypeFilter,
    statusFilter,
    setWarehouseFilter,
    setCountTypeFilter,
    setStatusFilter,
    resetFilters,
    page,
    setPage,
    selectedCount,
    setSelectedCount,
    warehouseOptions,
    countLines,
    isCountLinesLoading,
    createCount,
    isCreating,
    startCount,
    isStarting,
    submitCount,
    isSubmitting,
    cancelCount,
    isCancelling,
    refetch,
  } = useStockCounts()

  const hasFilters = warehouseFilter || countTypeFilter || statusFilter
  const statusOptions = CountStatusSchema.options

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Physical Inventory</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Count each location&apos;s stock against the system, review variances, and post
              adjustments.
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
                <ClipboardList className="h-4 w-4" />
                New Physical Inventory
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* A branch-scoped user's warehouse list is already backend-filtered
              down to their own branch — with only one possible location,
              "All Locations" vs. picking it are the same result, so the
              filter adds nothing. HQ/Business Owner sees every location and
              keeps it. */}
          {warehouseOptions.length > 1 && (
            <div className="w-56">
              <SearchableSelect
                value={warehouseFilter ?? ''}
                onChange={(v) => setWarehouseFilter(v || undefined)}
                placeholder="All Locations"
                ariaLabel="Filter by location"
                clearable
                options={warehouseOptions.map((wh) => ({
                  value: wh.id,
                  label: wh.branch?.name ?? wh.name,
                }))}
              />
            </div>
          )}
          <div className="w-44">
            <SearchableSelect
              value={countTypeFilter ?? ''}
              onChange={(v) => setCountTypeFilter(v || undefined)}
              placeholder="All Types"
              ariaLabel="Filter by count type"
              clearable
              options={(['full', 'cycle', 'spot'] as const).map((t) => ({
                value: t,
                label: COUNT_TYPE_LABELS[t],
              }))}
            />
          </div>
          <div className="w-44">
            <SearchableSelect
              value={statusFilter ?? ''}
              onChange={(v) => setStatusFilter((v || undefined) as CountStatus | undefined)}
              placeholder="All Statuses"
              ariaLabel="Filter by status"
              clearable
              options={statusOptions.map((s) => ({ value: s, label: COUNT_STATUS_LABELS[s] }))}
            />
          </div>
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
            <p className="text-sm font-medium text-red-800">Failed to load physical inventories</p>
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
                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : counts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No physical inventories found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Start a physical inventory to check stock against the system.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Location
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Scheduled
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Created By
                    </th>
                    <th className="w-12 px-2 py-3">
                      <span className="sr-only">Print</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {counts.map((count: CountSummary) => (
                    <tr
                      key={count.id}
                      onClick={() =>
                        // A scheduled count that's due opens already started.
                        count.status === 'scheduled' && isDue(count.scheduledDate)
                          ? void startCount(count.id)
                          : setSelectedCount(count)
                      }
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                        #{count.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {count.warehouse?.branch?.name ?? count.warehouse?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {COUNT_TYPE_LABELS[count.countType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[count.status]}`}
                        >
                          {COUNT_STATUS_LABELS[count.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {count.scheduledDate
                          ? formatManilaDate(count.scheduledDate, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                        {count.createdBy?.name ?? '—'}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {count.status === 'completed' && (
                          <PrintPhysicalInventoryButton count={count} variant="icon" />
                        )}
                      </td>
                    </tr>
                  ))}
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

      <CreateCountModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createCount}
        isSubmitting={isCreating}
        warehouses={warehouseOptions}
      />

      <CountSessionView
        count={selectedCount}
        onClose={() => setSelectedCount(null)}
        onStart={startCount}
        onSubmit={submitCount}
        onCancel={cancelCount}
        isStarting={isStarting}
        isSubmitting={isSubmitting}
        isCancelling={isCancelling}
        countLines={countLines}
        isCountLinesLoading={isCountLinesLoading}
      />
    </div>
  )
}
