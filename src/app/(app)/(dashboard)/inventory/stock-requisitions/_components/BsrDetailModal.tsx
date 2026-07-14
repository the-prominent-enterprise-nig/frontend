'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  X,
  Loader2,
  ClipboardCheck,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Package,
} from 'lucide-react'
import {
  ApproveBsrFormSchema,
  ApproveBsrFormValues,
  RejectBsrFormSchema,
  RejectBsrFormValues,
  BsrSummary,
  BsrStatus,
} from '@/src/schema/inventory/stock-requisitions'
import type { ApiResponse } from '@/src/libs/api/client'

const STATUS_CONFIG: Record<BsrStatus, { label: string; color: string; icon: React.ElementType }> =
  {
    draft: { label: 'Draft', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: ClipboardCheck },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'bg-zinc-100 text-zinc-500', icon: XCircle },
    fulfilled: { label: 'Fulfilled', color: 'bg-purple-100 text-purple-700', icon: Package },
  }

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  bsr: BsrSummary | null
  isLoading: boolean
  isOpen: boolean
  onClose: () => void
  canApprove: boolean
  onSubmit: (id: string) => Promise<ApiResponse<unknown>>
  onApprove: (id: string, data?: ApproveBsrFormValues) => Promise<ApiResponse<unknown>>
  onReject: (id: string, data: RejectBsrFormValues) => Promise<ApiResponse<unknown>>
  onCancel: (id: string) => Promise<ApiResponse<unknown>>
  onFulfill: (id: string) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  isApproving: boolean
  isRejecting: boolean
  isCancelling: boolean
  isFulfilling: boolean
}

export default function BsrDetailModal({
  bsr,
  isLoading,
  isOpen,
  onClose,
  canApprove,
  onSubmit,
  onApprove,
  onReject,
  onCancel,
  onFulfill,
  isSubmitting,
  isApproving,
  isRejecting,
  isCancelling,
  isFulfilling,
}: Props) {
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const approveForm = useForm<ApproveBsrFormValues>({
    resolver: zodResolver(ApproveBsrFormSchema),
    defaultValues: {},
  })

  const rejectForm = useForm<RejectBsrFormValues>({
    resolver: zodResolver(RejectBsrFormSchema),
    defaultValues: { reason: '' },
  })

  if (!isOpen) return null

  const status = bsr?.status ?? 'draft'
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon

  async function handleApproveSubmit(data: ApproveBsrFormValues) {
    if (!bsr) return
    const result = await onApprove(bsr.id, data)
    if (result.success) {
      setShowApproveForm(false)
      approveForm.reset()
    }
  }

  async function handleRejectSubmit(data: RejectBsrFormValues) {
    if (!bsr) return
    const result = await onReject(bsr.id, data)
    if (result.success) {
      setShowRejectForm(false)
      rejectForm.reset()
    }
  }

  async function handleCancel() {
    if (!bsr) return
    await onCancel(bsr.id)
    setConfirmCancel(false)
  }

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-prominent-purple-900">
                Requisition Details
              </h2>
              {bsr && <p className="mt-0.5 font-mono text-xs text-zinc-400">{bsr.code}</p>}
            </div>
            {bsr && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusCfg.color}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {statusCfg.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !bsr ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            {/* Route info */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Branch
                </p>
                <p className="mt-0.5 font-semibold text-prominent-purple-900">
                  {bsr.branch?.name ?? bsr.branchId}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  From Warehouse
                </p>
                <p className="mt-0.5 font-semibold text-prominent-purple-900">
                  {bsr.fromWarehouse?.name ?? bsr.fromWarehouseId}
                </p>
              </div>
            </div>

            {/* Notes */}
            {bsr.notes && (
              <div>
                <p className="text-xs font-medium text-zinc-400">Notes</p>
                <p className="mt-0.5 text-sm text-zinc-800">{bsr.notes}</p>
              </div>
            )}

            {/* Rejection reason */}
            {bsr.rejectionReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs font-medium text-red-500">Rejection Reason</p>
                <p className="mt-0.5 text-sm text-red-800">{bsr.rejectionReason}</p>
              </div>
            )}

            {/* Lines */}
            {bsr.lines && bsr.lines.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-700">Items</p>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Item
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Requested Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {bsr.lines.map((line, i) => (
                        <tr key={line.id ?? i}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-prominent-purple-900">
                              {line.item?.name ?? line.itemId ?? '—'}
                            </p>
                            {line.item?.sku && (
                              <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                            )}
                            {line.notes && (
                              <p className="text-xs text-zinc-400 italic">{line.notes}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-zinc-700">
                            {line.requestedQty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700">Timeline</p>
              <ol className="space-y-2">
                <TimelineEvent
                  icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                  label="Requisition created"
                  timestamp={bsr.createdAt}
                  color="text-zinc-500 bg-zinc-100"
                />
                {bsr.submittedAt && (
                  <TimelineEvent
                    icon={<AlertCircle className="h-3.5 w-3.5" />}
                    label="Submitted for approval"
                    timestamp={bsr.submittedAt}
                    color="text-blue-700 bg-blue-100"
                  />
                )}
                {bsr.approvedAt && (
                  <TimelineEvent
                    icon={<CheckCircle className="h-3.5 w-3.5" />}
                    label="Approved"
                    timestamp={bsr.approvedAt}
                    color="text-green-700 bg-green-100"
                  />
                )}
                {bsr.rejectedAt && (
                  <TimelineEvent
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    label="Rejected"
                    timestamp={bsr.rejectedAt}
                    color="text-red-600 bg-red-100"
                  />
                )}
                {bsr.fulfilledAt && (
                  <TimelineEvent
                    icon={<Package className="h-3.5 w-3.5" />}
                    label="Fulfilled"
                    timestamp={bsr.fulfilledAt}
                    color="text-purple-700 bg-purple-100"
                  />
                )}
              </ol>
            </div>

            {/* Approve form */}
            {showApproveForm && (
              <form
                onSubmit={approveForm.handleSubmit(handleApproveSubmit)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
              >
                <p className="text-sm font-medium text-zinc-700">Approve Requisition</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Reservation Hold Days (optional)
                  </label>
                  <Controller
                    name="reservationDays"
                    control={approveForm.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="number"
                        min="1"
                        max="90"
                        placeholder="e.g. 7"
                        className={fieldClass}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                        }
                        value={field.value ?? ''}
                      />
                    )}
                  />
                  {approveForm.formState.errors.reservationDays && (
                    <p className="mt-1 text-xs text-red-600">
                      {approveForm.formState.errors.reservationDays.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowApproveForm(false)
                      approveForm.reset()
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isApproving}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {isApproving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Approval
                  </button>
                </div>
              </form>
            )}

            {/* Reject form */}
            {showRejectForm && (
              <form
                onSubmit={rejectForm.handleSubmit(handleRejectSubmit)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
              >
                <p className="text-sm font-medium text-zinc-700">Reject Requisition</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="reason"
                    control={rejectForm.control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Provide a reason for rejection…"
                        className={`${fieldClass} resize-none`}
                      />
                    )}
                  />
                  {rejectForm.formState.errors.reason && (
                    <p className="mt-1 text-xs text-red-600">
                      {rejectForm.formState.errors.reason.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectForm(false)
                      rejectForm.reset()
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isRejecting}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isRejecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Rejection
                  </button>
                </div>
              </form>
            )}

            {/* Cancel confirm */}
            {confirmCancel && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Cancel this requisition?</p>
                <p className="mt-1 text-xs text-red-600">This cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isCancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Yes, Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        {bsr && !showApproveForm && !showRejectForm && !confirmCancel && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
            <div>
              {status === 'draft' && (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>

              {status === 'draft' && (
                <button
                  type="button"
                  onClick={() => onSubmit(bsr.id)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit for Approval
                </button>
              )}

              {status === 'submitted' && canApprove && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApproveForm(true)}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                </>
              )}

              {status === 'approved' && (
                <button
                  type="button"
                  onClick={() => onFulfill(bsr.id)}
                  disabled={isFulfilling}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {isFulfilling && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Package className="h-4 w-4" />
                  Mark Fulfilled
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineEvent({
  icon,
  label,
  timestamp,
  color,
}: {
  icon: React.ReactNode
  label: string
  timestamp?: string | null
  color: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm text-zinc-700">{label}</p>
        <p className="text-xs text-zinc-400">{formatDate(timestamp)}</p>
      </div>
    </li>
  )
}
