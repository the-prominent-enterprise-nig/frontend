'use client'

import { useState } from 'react'
import { Plus, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUdsManager } from '../_hooks/useUdsManager'
import CreateUdsModal from './CreateUdsModal'
import UpdateUdsStatusModal from './UpdateUdsStatusModal'
import {
  UDS_REASON_LABELS,
  UDS_STATUS_LABELS,
  UDS_STATUS_STYLES,
  UDS_REASON_STYLES,
  UDS_STATUSES,
  UDS_REASONS,
  type Uds,
  type UdsStatus,
} from '@/src/schema/inventory/uds'
import type { UpdateUdsStatusFormValues } from '@/src/schema/inventory/uds'

export default function UdsList() {
  const {
    records,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    reasonFilter,
    setStatusFilter,
    setReasonFilter,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    serialOptions,
    createUds,
    isCreating,
    updateStatus,
    isUpdatingStatus,
  } = useUdsManager()

  const [isCreateOpen, setCreateOpen] = useState(false)
  const [selectedUds, setSelectedUds] = useState<Uds | null>(null)

  const hasFilters = !!statusFilter || !!reasonFilter

  async function handleUpdateStatus(data: UpdateUdsStatusFormValues) {
    if (!selectedUds) return { success: false, error: 'No UDS selected', message: '' }
    return updateStatus(selectedUds.id, data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Unit Document Sheets</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Track units leaving the warehouse for repair, pull-out, maintenance, or loan.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-prominent-purple-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-prominent-purple-800"
          >
            <Plus className="h-4 w-4" />
            Issue UDS
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter ?? ''}
            onChange={(e) => setStatusFilter((e.target.value as UdsStatus) || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {UDS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {UDS_STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <select
            value={reasonFilter ?? ''}
            onChange={(e) => setReasonFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Reasons</option>
            {UDS_REASONS.map((r) => (
              <option key={r} value={r}>
                {UDS_REASON_LABELS[r]}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-zinc-500 hover:text-zinc-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load UDS records. Please try again.
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardCheck className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No Unit Document Sheets found</p>
              <p className="mt-1 text-xs text-zinc-400">
                {hasFilters
                  ? 'Try clearing your filters.'
                  : 'Issue a UDS to track units going for repair or pull-out.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Units</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3">Exp. Return</th>
                    <th className="px-5 py-3">Issued</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {records.map((uds) => (
                    <tr key={uds.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-zinc-800">
                        {uds.code}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${UDS_REASON_STYLES[uds.reason]}`}
                        >
                          {UDS_REASON_LABELS[uds.reason]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${UDS_STATUS_STYLES[uds.status]}`}
                        >
                          {UDS_STATUS_LABELS[uds.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-600">
                        {uds.lines.length} unit{uds.lines.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-600">
                        {uds.warehouse ? `${uds.warehouse.code} — ${uds.warehouse.name}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-600">
                        {uds.expectedReturnDate
                          ? new Date(uds.expectedReturnDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500 text-xs">
                        {new Date(uds.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {uds.status !== 'completed' && uds.status !== 'cancelled' && (
                          <button
                            onClick={() => setSelectedUds(uds)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                          >
                            Update
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
        {!isLoading && records.length > 0 && (
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <p>
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-zinc-700 font-medium">
                {pagination.page} / {pagination.lastPage}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.lastPage}
                className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateUdsModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createUds}
        isSubmitting={isCreating}
        warehouseOptions={warehouseOptions}
        serialOptions={serialOptions}
      />

      {selectedUds && (
        <UpdateUdsStatusModal
          isOpen={!!selectedUds}
          onClose={() => setSelectedUds(null)}
          onSubmit={handleUpdateStatus}
          isSubmitting={isUpdatingStatus}
          currentStatus={selectedUds.status}
        />
      )}
    </div>
  )
}
