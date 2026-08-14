'use client'

import { useState } from 'react'
import {
  Plus,
  RefreshCw,
  X,
  ArrowRight,
  Truck,
  CheckCircle,
  Inbox,
  Clock,
  Ban,
  XCircle,
  AlertTriangle,
  Search,
  Warehouse,
} from 'lucide-react'
import { useWarehouseRequestManager } from '../_hooks/useWarehouseRequestManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type {
  WarehouseRequestStatus,
  WarehouseRequestSummary,
} from '@/src/schema/inventory/warehouse-requests'
import CreateWarehouseRequestModal from './CreateWarehouseRequestModal'
import WarehouseRequestDetailModal from './WarehouseRequestDetailModal'

const STATUS_CONFIG: Record<
  WarehouseRequestStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  requested: { label: 'Requested', color: 'bg-purple-100 text-purple-700', icon: Inbox },
  ready: { label: 'Ready', color: 'bg-blue-100 text-blue-700', icon: Clock },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600', icon: Ban },
  in_transit: { label: 'In Transit', color: 'bg-amber-100 text-amber-700', icon: Truck },
  received: { label: 'Received', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partially_received: {
    label: 'Partially Received',
    color: 'bg-orange-100 text-orange-700',
    icon: AlertTriangle,
  },
  cancelled: { label: 'Cancelled', color: 'bg-zinc-100 text-zinc-500', icon: XCircle },
}

export default function WarehouseRequestList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSE_REQUESTS_CREATE)
  const canReceive = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSE_REQUESTS_RECEIVE)
  const canCancel = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSE_REQUESTS_CANCEL)
  const canAccept = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSE_REQUESTS_ACCEPT)
  const canReject = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSE_REQUESTS_REJECT)
  const canDispatch = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSE_REQUESTS_DISPATCH)

  const {
    requests,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    warehouseFilter,
    search,
    setSearch,
    setStatusFilter,
    setWarehouseFilter,
    resetFilters,
    page,
    setPage,
    selectedRequest,
    setSelectedRequest,
    requestDetail,
    isLoadingDetail,
    warehouseOptions,
    branchOptions,
    createRequest,
    isCreating,
    receiveRequest,
    isReceiving,
    cancelRequest,
    isCancelling,
    acceptRequest,
    isAccepting,
    rejectRequest,
    isRejecting,
    dispatchRequest,
    isDispatching,
    refetch,
  } = useWarehouseRequestManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  function openDetail(request: WarehouseRequestSummary) {
    setSelectedRequest(request)
  }

  const inScope = (branchId: string | undefined) =>
    !session.branchId || branchId === session.branchId
  const currentUserRegion = branchOptions.find((b) => b.id === session.branchId)?.region ?? null
  const inWarehouseRegion = (warehouseRegion: string | null | undefined) =>
    !session.branchId || warehouseRegion === currentUserRegion

  const hasFilters = statusFilter || warehouseFilter || search

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Warehouse Requests</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Request stock from a warehouse down to your branch.
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
                New Request
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search request #, item, SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-prominent-purple-500"
            />
          </div>

          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as WarehouseRequestStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="ready">Ready</option>
            <option value="rejected">Rejected</option>
            <option value="in_transit">In Transit</option>
            <option value="received">Received</option>
            <option value="partially_received">Partially Received</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={warehouseFilter ?? ''}
            onChange={(e) => setWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Warehouses</option>
            {warehouseOptions.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
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
            <p className="text-sm font-medium text-red-800">Failed to load warehouse requests</p>
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
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Warehouse className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No warehouse requests found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Request stock from a warehouse to see it here.
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
                      Requested
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
                  {requests.map((req) => {
                    const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.requested
                    const Icon = cfg.icon
                    const lineCount = req.lines?.length ?? 0

                    return (
                      <tr
                        key={req.id}
                        onClick={() => openDetail(req)}
                        className="cursor-pointer hover:bg-zinc-50"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                          {req.requestNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-zinc-700">
                            <span className="font-medium">{req.warehouse?.name ?? '—'}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span className="font-medium">{req.branch?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                          {req.requestedAt
                            ? new Date(req.requestedAt).toLocaleDateString('en-PH', {
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
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {req.status === 'requested' &&
                              (canAccept || canReject) &&
                              inWarehouseRegion(req.warehouse?.region) && (
                                <button
                                  type="button"
                                  onClick={() => openDetail(req)}
                                  className="rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
                                >
                                  Review
                                </button>
                              )}
                            {req.status === 'ready' &&
                              canDispatch &&
                              inWarehouseRegion(req.warehouse?.region) && (
                                <button
                                  type="button"
                                  onClick={() => openDetail(req)}
                                  className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                                >
                                  Dispatch
                                </button>
                              )}
                            {req.status === 'in_transit' && canReceive && inScope(req.branchId) && (
                              <button
                                type="button"
                                onClick={() => openDetail(req)}
                                className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                              >
                                Receive
                              </button>
                            )}
                            {(req.status === 'requested' || req.status === 'ready') &&
                              canCancel &&
                              (inScope(req.branchId) ||
                                inWarehouseRegion(req.warehouse?.region)) && (
                                <button
                                  type="button"
                                  onClick={() => openDetail(req)}
                                  className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                                >
                                  Cancel
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
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} requests
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

      <CreateWarehouseRequestModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createRequest}
        isSubmitting={isCreating}
        warehouseOptions={warehouseOptions}
        branchOptions={branchOptions}
        currentUserBranchId={session.branchId}
      />

      <WarehouseRequestDetailModal
        isOpen={!!selectedRequest}
        request={requestDetail}
        isLoading={isLoadingDetail}
        onClose={() => setSelectedRequest(null)}
        canReceive={canReceive}
        canCancel={canCancel}
        canAccept={canAccept}
        canReject={canReject}
        canDispatch={canDispatch}
        onReceive={receiveRequest}
        onCancel={cancelRequest}
        onAccept={acceptRequest}
        onReject={(id, reason) => rejectRequest(id, { reason })}
        onDispatch={dispatchRequest}
        isReceiving={isReceiving}
        isCancelling={isCancelling}
        isAccepting={isAccepting}
        isRejecting={isRejecting}
        isDispatching={isDispatching}
        currentUserBranchId={session.branchId}
        currentUserRegion={currentUserRegion}
      />
    </div>
  )
}
