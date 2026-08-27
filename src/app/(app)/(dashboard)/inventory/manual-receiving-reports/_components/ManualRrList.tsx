'use client'

import { RefreshCw, X, FileClock, Plus } from 'lucide-react'
import { useManualReceivingReports } from '../_hooks/useManualReceivingReports'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  MANUAL_RR_STATUS_LABELS,
  ManualReceivingReportStatusSchema,
  type ManualReceivingReportStatus,
} from '@/src/schema/inventory/manual-receiving-reports'
import { ADJUSTMENT_REASON_LABELS } from '@/src/schema/inventory/stock-counts'
import CreateManualRrModal from './CreateManualRrModal'
import ManualRrDetailView from './ManualRrDetailView'

const STATUS_COLORS: Record<ManualReceivingReportStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

export default function ManualRrList({ session }: { session: SessionUser }) {
  const canAct = hasPermission(session, INVENTORY_PERMISSIONS.MANUAL_RR_CREATE)

  const {
    reports,
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
    selectedReport,
    setSelectedReport,
    showCreateModal,
    setShowCreateModal,
    warehouseOptions,
    supplierOptions,
    submit,
    isSubmitting,
    approve,
    isApproving,
    reject,
    isRejecting,
    refetch,
  } = useManualReceivingReports()

  const hasFilters = warehouseFilter || statusFilter
  const statusOptions = ManualReceivingReportStatusSchema.options

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
              Manual Receiving Reports
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Originate a serial with no PO/transfer/count context — submitted by one person,
              approved by another.
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
            {canAct && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700"
              >
                <Plus className="h-4 w-4" />
                New Manual RR
              </button>
            )}
          </div>
        </div>

        {!canAct && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            This is an owner-controlled feature — you don&apos;t currently have access. Ask an
            account with access to grant it via Settings &gt; Roles &amp; Access if you need it.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
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
              setStatusFilter(
                (e.target.value || undefined) as ManualReceivingReportStatus | undefined
              )
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {MANUAL_RR_STATUS_LABELS[s]}
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
            <p className="text-sm font-medium text-red-800">
              Failed to load manual receiving reports
            </p>
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
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileClock className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No manual receiving reports found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Serial
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Location
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReport(r)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                        {r.code}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{r.item.name}</p>
                        <p className="font-mono text-xs text-zinc-400">{r.item.sku}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                        {r.serialNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.warehouse.branch?.name ?? r.warehouse.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {ADJUSTMENT_REASON_LABELS[r.reasonCode]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 hidden lg:table-cell">
                        {r.unitCost != null
                          ? Number(r.unitCost).toLocaleString('en-PH', {
                              style: 'currency',
                              currency: 'PHP',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}
                        >
                          {MANUAL_RR_STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {new Date(r.submittedAt).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
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

      <CreateManualRrModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={submit}
        isSubmitting={isSubmitting}
        warehouseOptions={warehouseOptions}
        supplierOptions={supplierOptions}
      />

      <ManualRrDetailView
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onApprove={approve}
        onReject={reject}
        isApproving={isApproving}
        isRejecting={isRejecting}
        canAct={canAct}
        currentUserId={session.id}
      />
    </div>
  )
}
