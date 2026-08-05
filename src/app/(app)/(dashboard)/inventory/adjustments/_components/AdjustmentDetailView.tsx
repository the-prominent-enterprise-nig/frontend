'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import type { ApiResponse } from '@/src/libs/api/client'
import {
  ADJUSTMENT_STATUS_LABELS,
  RejectAdjustmentFormSchema,
  type AdjustmentDetail,
  type RejectAdjustmentFormValues,
} from '@/src/schema/inventory/adjustments'
import { ADJUSTMENT_REASON_LABELS } from '@/src/schema/inventory/stock-counts'
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '@/src/schema/inventory/batches'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  NON_SALEABLE_SERIAL_STATUSES,
} from '@/src/schema/inventory/serial-numbers'

const NON_SALEABLE_BATCH_STATUSES = ['quarantine', 'expired', 'recalled'] as const

type Props = {
  adjustment: AdjustmentDetail | null
  onClose: () => void
  onConfirm: (id: string) => Promise<ApiResponse<unknown>>
  onInvestigate: (id: string) => Promise<ApiResponse<unknown>>
  onApprove: (id: string) => Promise<ApiResponse<unknown>>
  onReject: (args: {
    id: string
    data: RejectAdjustmentFormValues
  }) => Promise<ApiResponse<unknown>>
  isConfirming: boolean
  isInvestigating: boolean
  isApproving: boolean
  isRejecting: boolean
  canConfirm: boolean
  canInvestigate: boolean
  canApprove: boolean
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-zinc-100 text-zinc-600',
  confirmed: 'bg-blue-100 text-blue-700',
  investigating: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

export default function AdjustmentDetailView({
  adjustment,
  onClose,
  onConfirm,
  onInvestigate,
  onApprove,
  onReject,
  isConfirming,
  isInvestigating,
  isApproving,
  isRejecting,
  canConfirm,
  canInvestigate,
  canApprove,
}: Props) {
  const [showRejectForm, setShowRejectForm] = useState(false)

  const rejectForm = useForm<RejectAdjustmentFormValues>({
    resolver: zodResolver(RejectAdjustmentFormSchema),
    defaultValues: { reason: '' },
  })

  if (!adjustment) return null

  const isSubmitted = adjustment.status === 'submitted'
  const isConfirmed = adjustment.status === 'confirmed'
  const isInvestigatingStatus = adjustment.status === 'investigating'
  const isTerminal = adjustment.status === 'approved' || adjustment.status === 'rejected'

  async function handleReject(data: RejectAdjustmentFormValues) {
    const result = await onReject({ id: adjustment!.id, data })
    if (result.success) {
      setShowRejectForm(false)
      rejectForm.reset()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Adjustment {adjustment.adjustmentNumber}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {adjustment.warehouse?.name ?? '—'} &bull;{' '}
              {new Date(adjustment.adjustmentDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[adjustment.status]}`}
            >
              {ADJUSTMENT_STATUS_LABELS[adjustment.status]}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Reason</p>
              <p className="mt-0.5 text-zinc-900">
                {ADJUSTMENT_REASON_LABELS[adjustment.reasonCode]}
              </p>
            </div>
            {adjustment.totalImpactValue != null && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Impact Value
                </p>
                <p className="mt-0.5 text-zinc-900">
                  {adjustment.totalImpactValue.toLocaleString('en-PH', {
                    style: 'currency',
                    currency: 'PHP',
                  })}
                </p>
              </div>
            )}
            {adjustment.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Notes</p>
                <p className="mt-0.5 text-zinc-700">{adjustment.notes}</p>
              </div>
            )}
          </div>

          {adjustment.status === 'rejected' && adjustment.rejectedReason && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs text-red-800">
                <strong>Rejected:</strong> {adjustment.rejectedReason}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Lines</p>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                      Batch / Serial
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">
                      Expected
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">
                      Actual
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {adjustment.lines.map((line) => {
                    const variance = line.actualQty - line.expectedQty
                    const batchNonSaleable =
                      line.batch &&
                      (NON_SALEABLE_BATCH_STATUSES as readonly string[]).includes(line.batch.status)
                    const serialNonSaleable =
                      line.serialNumber &&
                      NON_SALEABLE_SERIAL_STATUSES.includes(line.serialNumber.status)
                    return (
                      <tr key={line.id}>
                        <td className="px-3 py-2 text-zinc-700">
                          {line.item.sku} — {line.item.name}
                        </td>
                        <td className="px-3 py-2">
                          {line.batch && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-600">
                                {line.batch.batchNumber}
                              </span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${BATCH_STATUS_COLORS[line.batch.status]}`}
                              >
                                {batchNonSaleable ? 'Non-saleable — ' : ''}
                                {BATCH_STATUS_LABELS[line.batch.status]}
                              </span>
                            </div>
                          )}
                          {line.serialNumber && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-600">
                                {line.serialNumber.serialNumber}
                              </span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SERIAL_STATUS_COLORS[line.serialNumber.status]}`}
                              >
                                {serialNonSaleable ? 'Non-saleable — ' : ''}
                                {SERIAL_STATUS_LABELS[line.serialNumber.status]}
                              </span>
                            </div>
                          )}
                          {!line.batch && !line.serialNumber && (
                            <span className="text-xs text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500">{line.expectedQty}</td>
                        <td className="px-3 py-2 text-right text-zinc-500">{line.actualQty}</td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {variance >= 0 ? '+' : ''}
                          {variance}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {!isTerminal && (
            <div className="space-y-3 border-t border-zinc-200 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Approval Chain
              </p>
              <ol className="space-y-1.5 text-sm text-zinc-600">
                <li className={isSubmitted ? 'font-semibold text-zinc-900' : ''}>
                  1. Branch Manager confirms {adjustment.confirmedById && '✓'}
                </li>
                <li className={isConfirmed ? 'font-semibold text-zinc-900' : ''}>
                  2. HO Inventory investigates {adjustment.investigatingById && '✓'}
                </li>
                <li className={isInvestigatingStatus ? 'font-semibold text-zinc-900' : ''}>
                  3. Accountant approves or rejects
                </li>
              </ol>

              {showRejectForm ? (
                <form onSubmit={rejectForm.handleSubmit(handleReject)} className="space-y-3">
                  <Controller
                    name="reason"
                    control={rejectForm.control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={2}
                        placeholder="Reason for rejecting…"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
                      />
                    )}
                  />
                  {rejectForm.formState.errors.reason && (
                    <p className="text-xs text-red-600">
                      {rejectForm.formState.errors.reason.message}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRejecting}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {isRejecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm Rejection
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-end gap-2">
                  {isSubmitted && canConfirm && (
                    <button
                      type="button"
                      onClick={() => onConfirm(adjustment.id)}
                      disabled={isConfirming}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirm
                    </button>
                  )}
                  {isConfirmed && canInvestigate && (
                    <button
                      type="button"
                      onClick={() => onInvestigate(adjustment.id)}
                      disabled={isInvestigating}
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {isInvestigating && <Loader2 className="h-4 w-4 animate-spin" />}
                      Move to Investigating
                    </button>
                  )}
                  {isInvestigatingStatus && canApprove && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowRejectForm(true)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => onApprove(adjustment.id)}
                        disabled={isApproving}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Approve
                      </button>
                    </>
                  )}
                  {!(
                    (isSubmitted && canConfirm) ||
                    (isConfirmed && canInvestigate) ||
                    (isInvestigatingStatus && canApprove)
                  ) && (
                    <p className="text-xs text-zinc-400">
                      Waiting on the next step — you don&apos;t hold the permission for it.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
