'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import type { ApiResponse } from '@/src/libs/api/client'
import {
  MANUAL_RR_STATUS_LABELS,
  RejectManualReceivingReportFormSchema,
  type ManualReceivingReport,
  type RejectManualReceivingReportFormValues,
} from '@/src/schema/inventory/manual-receiving-reports'
import { ADJUSTMENT_REASON_LABELS } from '@/src/schema/inventory/stock-counts'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

type Props = {
  report: ManualReceivingReport | null
  onClose: () => void
  onApprove: (id: string) => Promise<ApiResponse<unknown>>
  onReject: (args: {
    id: string
    data: RejectManualReceivingReportFormValues
  }) => Promise<ApiResponse<unknown>>
  isApproving: boolean
  isRejecting: boolean
  canAct: boolean
  currentUserId?: string
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="mt-0.5 text-zinc-800">{value}</p>
    </div>
  )
}

export default function ManualRrDetailView({
  report,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  canAct,
  currentUserId,
}: Props) {
  const [showRejectForm, setShowRejectForm] = useState(false)

  const rejectForm = useForm<RejectManualReceivingReportFormValues>({
    resolver: zodResolver(RejectManualReceivingReportFormSchema),
    defaultValues: { reason: '' },
  })

  if (!report) return null

  const isPending = report.status === 'pending'
  // Mirrors the server-side self-approval block — hiding the buttons for
  // the report's own submitter avoids a round-trip just to learn "no".
  const isOwnSubmission = currentUserId === report.submittedById
  const canActOnThis = canAct && isPending && !isOwnSubmission

  async function handleReject(data: RejectManualReceivingReportFormValues) {
    const result = await onReject({ id: report!.id, data })
    if (result.success) {
      setShowRejectForm(false)
      rejectForm.reset()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center px-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-t-2xl md:rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-prominent-purple-900">{report.code}</h2>
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[report.status]}`}
            >
              {MANUAL_RR_STATUS_LABELS[report.status]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Item" value={`${report.item.name} (${report.item.sku})`} />
            <InfoRow label="Warehouse" value={report.warehouse.name} />
            <InfoRow label="Serial Number" value={report.serialNumber} />
            <InfoRow label="Reason" value={ADJUSTMENT_REASON_LABELS[report.reasonCode]} />
            {report.unitCost != null && (
              <InfoRow
                label="Unit Cost"
                value={Number(report.unitCost).toLocaleString('en-PH', {
                  style: 'currency',
                  currency: 'PHP',
                })}
              />
            )}
            {report.supplier && (
              <InfoRow
                label="Supplier"
                value={`${report.supplier.code} — ${report.supplier.name}`}
              />
            )}
            <InfoRow label="Submitted By" value={report.submittedByName ?? report.submittedById} />
            <InfoRow
              label="Submitted At"
              value={new Date(report.submittedAt).toLocaleString('en-PH')}
            />
          </div>
          {report.notes && <InfoRow label="Notes" value={report.notes} />}

          {report.status === 'approved' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <InfoRow
                label="Approved By"
                value={report.approvedByName ?? report.approvedById ?? '—'}
              />
              {report.approvedAt && (
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(report.approvedAt).toLocaleString('en-PH')}
                </p>
              )}
              {report.createdSerial && (
                <p className="mt-2 text-xs text-green-700">
                  Serial <span className="font-mono">{report.createdSerial.serialNumber}</span>{' '}
                  originated, now in stock.
                </p>
              )}
              {report.journalEntryId ? (
                <p className="mt-1 text-xs text-green-700">
                  Journal entry posted (Dr Inventory / Cr AP
                  {report.withheldAmount ? ' / Cr WHT Payable' : ''}).
                </p>
              ) : (
                report.unitCost == null && (
                  <p className="mt-1 text-xs text-zinc-500">
                    No unit cost was given — this unit was received with no financial value.
                  </p>
                )
              )}
            </div>
          )}

          {report.status === 'rejected' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <InfoRow
                label="Rejected By"
                value={report.rejectedByName ?? report.rejectedById ?? '—'}
              />
              {report.rejectedReason && (
                <p className="mt-1 text-zinc-700">{report.rejectedReason}</p>
              )}
            </div>
          )}

          {isPending && isOwnSubmission && (
            <p className="text-xs text-zinc-500">
              You submitted this report — someone else with manual-RR access needs to approve or
              reject it.
            </p>
          )}

          {showRejectForm && (
            <form
              onSubmit={rejectForm.handleSubmit(handleReject)}
              className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
            >
              <Controller
                name="reason"
                control={rejectForm.control}
                render={({ field: f }) => (
                  <textarea
                    {...f}
                    rows={2}
                    placeholder="Why is this report being rejected?"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-red-400"
                  />
                )}
              />
              {rejectForm.formState.errors.reason && (
                <p className="text-xs text-red-600">{rejectForm.formState.errors.reason.message}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isRejecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          )}
        </div>

        {canActOnThis && !showRejectForm && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => onApprove(report.id)}
              disabled={isApproving}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {isApproving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
