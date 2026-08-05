'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, Search, ThumbsUp, ThumbsDown, Undo2, X } from 'lucide-react'
import { useAdjustmentApprovals } from '../_hooks/useAdjustmentApprovals'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  ADJUSTMENT_STATUS_LABELS,
  AdjustmentStatusSchema,
  type AdjustmentStatus,
  type AdjustmentSummary,
} from '@/src/schema/inventory/adjustments'
import AdjustmentDetailModal from './AdjustmentDetailModal'

const STATUS_COLORS: Record<AdjustmentStatus, string> = {
  submitted: 'bg-zinc-100 text-zinc-600',
  confirmed: 'bg-blue-100 text-blue-700',
  investigating: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

export default function AdjustmentApprovalsList({ session }: { session: SessionUser }) {
  const canConfirm = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE)
  const canWithdraw = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_ADJUST)
  const [rejectTarget, setRejectTarget] = useState<AdjustmentSummary | null>(null)
  const [detailTarget, setDetailTarget] = useState<AdjustmentSummary | null>(null)

  const {
    adjustments,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    confirm,
    isConfirming,
    startInvestigation,
    isInvestigating,
    approve,
    isApproving,
    reject,
    isRejecting,
    withdraw,
    isWithdrawing,
    refetch,
  } = useAdjustmentApprovals()

  const statusOptions = AdjustmentStatusSchema.options

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Adjustment Approvals</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Confirm, investigate, and approve or reject pending stock adjustments.
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
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Search className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No adjustments found</p>
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
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Reason
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
                  {adjustments.map((adj: AdjustmentSummary) => (
                    <tr
                      key={adj.id}
                      onClick={() => setDetailTarget(adj)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-500">
                        #{adj.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{adj.item?.name ?? '—'}</p>
                        <p className="font-mono text-xs text-zinc-400">{adj.item?.sku}</p>
                        {adj.lines.length > 1 && (
                          <p className="text-xs text-zinc-400">
                            +{adj.lines.length - 1} more line(s)
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{adj.warehouse?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {adj.lines[0]
                          ? `${adj.lines[0].expectedQty} → ${adj.lines[0].actualQty}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {adj.reasonCode}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[adj.status]}`}
                        >
                          {ADJUSTMENT_STATUS_LABELS[adj.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {adj.status === 'submitted' && canWithdraw && (
                            <button
                              type="button"
                              onClick={() => withdraw(adj.id)}
                              disabled={isWithdrawing}
                              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Withdraw
                            </button>
                          )}
                          {adj.status === 'submitted' && canConfirm && (
                            <button
                              type="button"
                              onClick={() => confirm(adj.id)}
                              disabled={isConfirming}
                              className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                            </button>
                          )}
                          {adj.status === 'confirmed' && canApprove && (
                            <button
                              type="button"
                              onClick={() => startInvestigation(adj.id)}
                              disabled={isInvestigating}
                              className="flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              <Search className="h-3.5 w-3.5" /> Investigate
                            </button>
                          )}
                          {adj.status === 'investigating' && canApprove && (
                            <>
                              <button
                                type="button"
                                onClick={() => approve(adj.id)}
                                disabled={isApproving}
                                className="flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectTarget(adj)}
                                className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
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

      {detailTarget && (
        <AdjustmentDetailModal adjustment={detailTarget} onClose={() => setDetailTarget(null)} />
      )}

      {rejectTarget && (
        <RejectDialog
          adjustment={rejectTarget}
          isRejecting={isRejecting}
          onClose={() => setRejectTarget(null)}
          onReject={async (reason) => {
            await reject({ id: rejectTarget.id, data: { reason } })
            setRejectTarget(null)
          }}
        />
      )}
    </div>
  )
}

function RejectDialog({
  adjustment,
  isRejecting,
  onClose,
  onReject,
}: {
  adjustment: AdjustmentSummary
  isRejecting: boolean
  onClose: () => void
  onReject: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('A reason is required to reject an adjustment.')
      return
    }
    setError(null)
    await onReject(reason.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">Reject Adjustment</h3>
          <button onClick={onClose} type="button">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <p className="text-sm text-gray-600">
            Reject the adjustment for{' '}
            <span className="font-medium">{adjustment.item?.name ?? 'this item'}</span>? No stock or
            GL changes will be posted.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Reason *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400"
            />
          </label>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRejecting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isRejecting ? 'Rejecting...' : 'Reject Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
