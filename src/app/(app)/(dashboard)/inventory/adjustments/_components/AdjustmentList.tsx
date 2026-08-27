'use client'

import { RefreshCw, X, ClipboardCheck } from 'lucide-react'
import { useAdjustments } from '../_hooks/useAdjustments'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  ADJUSTMENT_STATUS_LABELS,
  AdjustmentStatusSchema,
  type AdjustmentStatus,
} from '@/src/schema/inventory/adjustments'
import { ADJUSTMENT_REASON_LABELS } from '@/src/schema/inventory/stock-counts'
import AdjustmentDetailView from './AdjustmentDetailView'

const STATUS_COLORS: Record<AdjustmentStatus, string> = {
  submitted: 'bg-zinc-100 text-zinc-600',
  confirmed: 'bg-blue-100 text-blue-700',
  investigating: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

export default function AdjustmentList({ session }: { session: SessionUser }) {
  const canConfirm = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM)
  const canInvestigate = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_INVESTIGATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE)
  const canWithdraw = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_ADJUST)

  const {
    adjustments,
    pagination,
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
    selectedAdjustment,
    setSelectedAdjustment,
    warehouseOptions,
    confirm,
    isConfirming,
    investigate,
    isInvestigating,
    approve,
    isApproving,
    reject,
    isRejecting,
    withdraw,
    isWithdrawing,
    refetch,
  } = useAdjustments()

  const hasFilters = warehouseFilter || statusFilter
  const statusOptions = AdjustmentStatusSchema.options

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Adjustments</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Review and act on pending adjustments through the approval chain.
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

        <div className="flex flex-wrap gap-3">
          {/* A branch-scoped user's warehouse list is already backend-filtered
              down to their own branch — with only one possible location,
              "All Locations" vs. picking it are the same result, so the
              filter adds nothing. HQ/Business Owner sees every location and
              keeps it. */}
          {warehouseOptions.length > 1 && (
            <select
              value={warehouseFilter ?? ''}
              onChange={(e) => setWarehouseFilter(e.target.value || undefined)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            >
              <option value="">All Locations</option>
              {warehouseOptions.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.branch?.name ?? wh.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as AdjustmentStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {ADJUSTMENT_STATUS_LABELS[s]}
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
            <p className="text-sm font-medium text-red-800">Failed to load adjustments</p>
          </div>
        )}

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
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardCheck className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No adjustments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Location
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {adjustments.map((adj) => (
                    <tr
                      key={adj.id}
                      onClick={() => setSelectedAdjustment(adj)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                        {adj.adjustmentNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">
                          {adj.lines[0]?.item?.name ?? '—'}
                        </p>
                        {adj.lines[0]?.item?.sku && (
                          <p className="font-mono text-xs text-zinc-400">{adj.lines[0].item.sku}</p>
                        )}
                        {adj.lines.length > 1 && (
                          <p className="text-xs text-zinc-400">
                            +{adj.lines.length - 1} more line(s)
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {adj.warehouse?.branch?.name ?? adj.warehouse?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {ADJUSTMENT_REASON_LABELS[adj.reasonCode]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[adj.status]}`}
                        >
                          {ADJUSTMENT_STATUS_LABELS[adj.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {new Date(adj.adjustmentDate).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {adj.status === 'submitted' && canWithdraw && (
                            <button
                              type="button"
                              onClick={() => withdraw(adj.id)}
                              disabled={isWithdrawing}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                            >
                              Withdraw
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

      <AdjustmentDetailView
        adjustment={selectedAdjustment}
        onClose={() => setSelectedAdjustment(null)}
        onConfirm={confirm}
        onInvestigate={investigate}
        onApprove={approve}
        onReject={reject}
        onWithdraw={withdraw}
        isConfirming={isConfirming}
        isInvestigating={isInvestigating}
        isApproving={isApproving}
        isRejecting={isRejecting}
        isWithdrawing={isWithdrawing}
        canConfirm={canConfirm}
        canInvestigate={canInvestigate}
        canApprove={canApprove}
        canWithdraw={canWithdraw}
      />
    </div>
  )
}
