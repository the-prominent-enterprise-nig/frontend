'use client'

import { useState } from 'react'
import {
  Plus,
  RefreshCw,
  X,
  ClipboardCheck,
  CheckCircle,
  Clock,
  XCircle,
  Package,
} from 'lucide-react'
import { useBsrManager } from '../_hooks/useBsrManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { BsrStatus, BsrSummary } from '@/src/schema/inventory/stock-requisitions'
import CreateBsrModal from './CreateBsrModal'
import BsrDetailModal from './BsrDetailModal'

const STATUS_CONFIG: Record<BsrStatus, { label: string; color: string; icon: React.ElementType }> =
  {
    draft: { label: 'Draft', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: ClipboardCheck },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'bg-zinc-100 text-zinc-500', icon: XCircle },
    fulfilled: { label: 'Fulfilled', color: 'bg-purple-100 text-purple-700', icon: Package },
  }

export default function BsrList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_REQUISITIONS_CREATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_REQUISITIONS_APPROVE)

  const {
    bsrs,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    branchFilter,
    setStatusFilter,
    setBranchFilter,
    resetFilters,
    page,
    setPage,
    selectedBsr,
    setSelectedBsr,
    bsrDetail,
    isLoadingDetail,
    warehouseOptions,
    itemOptions,
    branchOptions,
    createBsr,
    isCreating,
    submitBsr,
    isSubmitting,
    approveBsr,
    isApproving,
    rejectBsr,
    isRejecting,
    cancelBsr,
    isCancelling,
    fulfillBsr,
    isFulfilling,
    refetch,
  } = useBsrManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  function openDetail(bsr: BsrSummary) {
    setSelectedBsr(bsr)
  }

  const hasFilters = statusFilter || branchFilter

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Requisitions</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Branch stock requests with quantity reservation.
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
                New Requisition
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as BsrStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="fulfilled">Fulfilled</option>
          </select>

          {branchOptions.length > 0 && (
            <select
              value={branchFilter ?? ''}
              onChange={(e) => setBranchFilter(e.target.value || undefined)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            >
              <option value="">All Branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

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
            <p className="text-sm font-medium text-red-800">Failed to load requisitions</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
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
          ) : bsrs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardCheck className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No requisitions found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a requisition to request stock from a warehouse.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Lines
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {bsrs.map((bsr) => {
                    const cfg = STATUS_CONFIG[bsr.status] ?? STATUS_CONFIG.draft
                    const Icon = cfg.icon
                    const lineCount = bsr._count?.lines ?? bsr.lines?.length ?? 0

                    return (
                      <tr key={bsr.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-700">
                          {bsr.code}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                          {bsr.branch?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">
                          {bsr.fromWarehouse?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-600">{lineCount}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                          {bsr.createdAt
                            ? new Date(bsr.createdAt).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openDetail(bsr)}
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
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}{' '}
              requisitions
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

      <CreateBsrModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createBsr}
        isSubmitting={isCreating}
        branches={branchOptions}
        warehouses={warehouseOptions}
        items={itemOptions}
      />

      <BsrDetailModal
        isOpen={!!selectedBsr}
        bsr={bsrDetail}
        isLoading={isLoadingDetail}
        onClose={() => setSelectedBsr(null)}
        canApprove={canApprove}
        onSubmit={submitBsr}
        onApprove={approveBsr}
        onReject={rejectBsr}
        onCancel={cancelBsr}
        onFulfill={fulfillBsr}
        isSubmitting={isSubmitting}
        isApproving={isApproving}
        isRejecting={isRejecting}
        isCancelling={isCancelling}
        isFulfilling={isFulfilling}
      />
    </div>
  )
}
