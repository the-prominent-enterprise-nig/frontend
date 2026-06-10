'use client'

import { useState } from 'react'
import { CalendarDays, RefreshCw, X, Loader2 } from 'lucide-react'
import { useCycleCounts } from '../_hooks/useCycleCounts'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  COUNT_STATUS_LABELS,
  CountStatusSchema,
  type CountStatus,
  type CountSummary,
} from '@/src/schema/inventory/stock-counts'
import ScheduleCountModal from './ScheduleCountModal'

const STATUS_COLORS: Record<CountStatus, string> = {
  scheduled: 'bg-zinc-100 text-zinc-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

const statusOptions = CountStatusSchema.options

export default function CycleCountList({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.CYCLE_COUNT_MANAGE)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)

  const {
    counts,
    pagination,
    completedCounts,
    inProgressCounts,
    completionRate,
    isLoading,
    isFetching,
    error,
    warehouseFilter,
    statusFilter,
    setWarehouseFilter,
    setStatusFilter,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    scheduleCount,
    isScheduling,
    startCount,
    isStarting,
    cancelCount,
    isCancelling,
    refetch,
  } = useCycleCounts()

  const hasFilters = warehouseFilter || statusFilter
  const [startingId, setStartingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleStart(id: string) {
    setStartingId(id)
    try {
      await startCount(id)
    } finally {
      setStartingId(null)
    }
  }

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      await cancelCount(id)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Scheduled Cycle Counts</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Plan, track, and complete periodic cycle count sessions by warehouse.
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
                onClick={() => setIsScheduleOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <CalendarDays className="h-4 w-4" />
                Schedule Count
              </button>
            )}
          </div>
        </div>

        {/* Progress summary */}
        {counts.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-sm font-medium text-zinc-600">Total Scheduled</p>
              <p className="mt-1 text-3xl font-bold text-zinc-900">{counts.length}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-medium text-blue-700">In Progress</p>
              <p className="mt-1 text-3xl font-bold text-blue-900">{inProgressCounts.length}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <p className="text-sm font-medium text-green-700">Completion Rate</p>
              <p className="mt-1 text-3xl font-bold text-green-900">{completionRate}%</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-green-200">
                <div
                  className="h-full rounded-full bg-green-600 transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={warehouseFilter ?? ''}
            onChange={(e) => setWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Warehouses</option>
            {warehouseOptions.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} — {wh.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as CountStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {COUNT_STATUS_LABELS[s]}
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
            <p className="text-sm font-medium text-red-800">Failed to load cycle counts</p>
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
              <CalendarDays className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No cycle counts scheduled</p>
              {canManage && (
                <p className="mt-1 text-xs text-zinc-400">
                  Schedule a cycle count to start your periodic inventory verification program.
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
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Scheduled
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Started
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {counts.map((count: CountSummary) => (
                    <tr key={count.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                        #{count.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {count.warehouse?.name ?? '—'}
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
                          ? new Date(count.scheduledDate).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                        {count.startedAt
                          ? new Date(count.startedAt).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {count.status === 'scheduled' && canManage && (
                            <button
                              type="button"
                              disabled={startingId === count.id}
                              onClick={() => handleStart(count.id)}
                              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {startingId === count.id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              Start
                            </button>
                          )}
                          {(count.status === 'scheduled' || count.status === 'in_progress') &&
                            canManage && (
                              <button
                                type="button"
                                disabled={cancellingId === count.id}
                                onClick={() => handleCancel(count.id)}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {cancellingId === count.id && (
                                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                                )}
                                Cancel
                              </button>
                            )}
                        </div>
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

      <ScheduleCountModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onSubmit={scheduleCount}
        isSubmitting={isScheduling}
        warehouses={warehouseOptions}
      />
    </div>
  )
}
