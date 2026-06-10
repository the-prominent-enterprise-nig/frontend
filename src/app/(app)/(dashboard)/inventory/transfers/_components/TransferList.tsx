'use client'

import { useState } from 'react'
import { Plus, RefreshCw, X, ArrowRight, Truck, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useTransferManager } from '../_hooks/useTransferManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { TransferStatus, TransferSummary } from '@/src/schema/inventory/transfers'
import CreateTransferModal from './CreateTransferModal'
import TransferDetailModal from './TransferDetailModal'

const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
  in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-700', icon: Truck },
  received: { label: 'Received', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-500', icon: XCircle },
}

export default function TransferList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_CREATE)
  const canDispatch = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_DISPATCH)
  const canReceive = hasPermission(session, INVENTORY_PERMISSIONS.TRANSFERS_RECEIVE)

  const {
    transfers,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    fromWarehouseFilter,
    toWarehouseFilter,
    setStatusFilter,
    setFromWarehouseFilter,
    setToWarehouseFilter,
    resetFilters,
    page,
    setPage,
    selectedTransfer,
    setSelectedTransfer,
    transferDetail,
    isLoadingDetail,
    warehouseOptions,
    itemOptions,
    createTransfer,
    isCreating,
    dispatchTransfer,
    isDispatching,
    receiveTransfer,
    isReceiving,
    cancelTransfer,
    isCancelling,
    refetch,
  } = useTransferManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  function openDetail(transfer: TransferSummary) {
    setSelectedTransfer(transfer)
  }

  const hasFilters = statusFilter || fromWarehouseFilter || toWarehouseFilter

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Transfers</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Move stock between warehouses with full ledger traceability.
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
                New Transfer
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as TransferStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_transit">In Transit</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={fromWarehouseFilter ?? ''}
            onChange={(e) => setFromWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Sources</option>
            {warehouseOptions.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} — {wh.name}
              </option>
            ))}
          </select>

          <select
            value={toWarehouseFilter ?? ''}
            onChange={(e) => setToWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Destinations</option>
            {warehouseOptions.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} — {wh.name}
              </option>
            ))}
          </select>

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
            <p className="text-sm font-medium text-red-800">Failed to load transfers</p>
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
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ArrowRight className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No transfers found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a transfer to move stock between warehouses.
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
                      Route
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Date
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Items
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {transfers.map((tr) => {
                    const cfg = STATUS_CONFIG[tr.status] ?? STATUS_CONFIG.draft
                    const Icon = cfg.icon
                    const lineCount = tr._count?.lines ?? tr.lines?.length ?? 0

                    return (
                      <tr key={tr.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                          #{tr.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-zinc-700">
                            <span className="font-medium">{tr.fromWarehouse?.code ?? '—'}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <span className="font-medium">{tr.toWarehouse?.code ?? '—'}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-zinc-400 max-w-[200px]">
                            {tr.fromWarehouse?.name} → {tr.toWarehouse?.name}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                          {tr.transferDate
                            ? new Date(tr.transferDate).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openDetail(tr)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                            >
                              View
                            </button>
                            {tr.status === 'draft' && canDispatch && (
                              <button
                                type="button"
                                onClick={() => openDetail(tr)}
                                className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                Dispatch
                              </button>
                            )}
                            {tr.status === 'in_transit' && canReceive && (
                              <button
                                type="button"
                                onClick={() => openDetail(tr)}
                                className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                              >
                                Receive
                              </button>
                            )}
                          </div>
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
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} transfers
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

      <CreateTransferModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createTransfer}
        isSubmitting={isCreating}
        warehouses={warehouseOptions}
        items={itemOptions}
      />

      <TransferDetailModal
        isOpen={!!selectedTransfer}
        transfer={transferDetail}
        isLoading={isLoadingDetail}
        onClose={() => setSelectedTransfer(null)}
        canDispatch={canDispatch}
        canReceive={canReceive}
        onDispatch={dispatchTransfer}
        onReceive={receiveTransfer}
        onCancel={cancelTransfer}
        isDispatching={isDispatching}
        isReceiving={isReceiving}
        isCancelling={isCancelling}
      />
    </div>
  )
}
