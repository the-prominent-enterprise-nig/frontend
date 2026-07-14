'use client'

import { useState } from 'react'
import { Plus, RefreshCw, X, Trash2 } from 'lucide-react'
import { useWriteOffManager } from '../_hooks/useWriteOffManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  REASON_CODE_LABELS,
  WriteOffReasonCode,
  WriteOffReasonCodeSchema,
  WriteOffStatus,
  WriteOffStatusSchema,
  WriteOffSummary,
} from '@/src/schema/inventory/write-offs'
import CreateWriteOffModal from './CreateWriteOffModal'
import WriteOffDetailModal from './WriteOffDetailModal'

const REASON_COLORS: Record<WriteOffReasonCode, string> = {
  damaged: 'bg-orange-100 text-orange-700',
  expired: 'bg-yellow-100 text-yellow-700',
  write_off: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<WriteOffStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_COLORS: Record<WriteOffStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

const reasonCodes = WriteOffReasonCodeSchema.options
const writeOffStatuses = WriteOffStatusSchema.options

export default function WriteOffList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.WRITE_OFFS_CREATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.WRITE_OFFS_APPROVE)

  const {
    writeOffs,
    pagination,
    isLoading,
    isFetching,
    error,
    reasonCodeFilter,
    warehouseFilter,
    statusFilter,
    fromDate,
    toDate,
    setReasonCodeFilter,
    setWarehouseFilter,
    setStatusFilter,
    setFromDate,
    setToDate,
    resetFilters,
    page,
    setPage,
    selectedWriteOff,
    setSelectedWriteOff,
    writeOffDetail,
    isLoadingDetail,
    warehouseOptions,
    itemOptions,
    createWriteOff,
    isCreating,
    approveWriteOff,
    isApproving,
    rejectWriteOff,
    isRejecting,
    refetch,
  } = useWriteOffManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const hasFilters = reasonCodeFilter || warehouseFilter || statusFilter || fromDate || toDate

  function openDetail(wo: WriteOffSummary) {
    setSelectedWriteOff(wo)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
              Stock Write-offs
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Write off damaged, expired, or lost stock. Each entry posts an expense to the
              Inventory Loss account.
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
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                New Write-off
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={reasonCodeFilter ?? ''}
            onChange={(e) =>
              setReasonCodeFilter((e.target.value || undefined) as WriteOffReasonCode | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Reasons</option>
            {reasonCodes.map((code) => (
              <option key={code} value={code}>
                {REASON_CODE_LABELS[code]}
              </option>
            ))}
          </select>

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
              setStatusFilter((e.target.value || undefined) as WriteOffStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {writeOffStatuses.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate ?? ''}
            onChange={(e) => setFromDate(e.target.value || undefined)}
            title="From date"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          />
          <input
            type="date"
            value={toDate ?? ''}
            onChange={(e) => setToDate(e.target.value || undefined)}
            title="To date"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          />

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
            <p className="text-sm font-medium text-red-800">Failed to load write-offs</p>
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
          ) : writeOffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Trash2 className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No write-offs recorded</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Record a write-off to account for damaged or lost stock.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Ref
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
                      Reason
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Accounting Entry
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {writeOffs.map((wo) => {
                    const reasonColor = REASON_COLORS[wo.reasonCode] ?? 'bg-zinc-100 text-zinc-600'
                    return (
                      <tr key={wo.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                          #{wo.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-prominent-purple-900">
                            {wo.item?.name ?? '—'}
                          </p>
                          {wo.item?.sku && (
                            <p className="font-mono text-xs text-zinc-400">{wo.item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                          {wo.warehouse?.code ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-zinc-700">
                          {wo.quantity ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${reasonColor}`}
                          >
                            {REASON_CODE_LABELS[wo.reasonCode]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {wo.writeOffStatus ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[wo.writeOffStatus]}`}
                            >
                              {STATUS_LABELS[wo.writeOffStatus]}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                          {wo.writeOffDate
                            ? new Date(wo.writeOffDate).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {wo.accountingEntry ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Posted
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openDetail(wo)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                          >
                            View
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} write-offs
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

      <CreateWriteOffModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createWriteOff}
        isSubmitting={isCreating}
        warehouses={warehouseOptions}
        items={itemOptions}
      />

      <WriteOffDetailModal
        isOpen={!!selectedWriteOff}
        writeOff={writeOffDetail}
        isLoading={isLoadingDetail}
        onClose={() => setSelectedWriteOff(null)}
        canApprove={canApprove}
        onApprove={approveWriteOff}
        onReject={rejectWriteOff}
        isApproving={isApproving}
        isRejecting={isRejecting}
      />
    </div>
  )
}
