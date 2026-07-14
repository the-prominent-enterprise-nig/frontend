'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  X,
  Loader2,
  ExternalLink,
  Receipt,
  ImageOff,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import {
  REASON_CODE_LABELS,
  RejectWriteOffFormSchema,
  RejectWriteOffFormValues,
  WriteOffStatus,
  WriteOffSummary,
} from '@/src/schema/inventory/write-offs'
import {
  listWriteOffPhotos,
  removeWriteOffPhoto,
  type WriteOffPhoto,
} from '../_actions/write-off-photos'
import { showToast } from '@/src/components/ui/toast'
import type { ApiResponse } from '@/src/libs/api/client'

const STATUS_CONFIG: Record<
  WriteOffStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600', icon: XCircle },
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
  isOpen: boolean
  writeOff: WriteOffSummary | null
  isLoading: boolean
  onClose: () => void
  canApprove: boolean
  onApprove: (id: string) => Promise<ApiResponse<unknown>>
  onReject: (id: string, reason: string) => Promise<ApiResponse<unknown>>
  isApproving: boolean
  isRejecting: boolean
}

function photoUrl(fileId: string) {
  return `/api/files/${fileId}/download`
}

function PhotoThumbnail({
  photo,
  onRemove,
  isRemoving,
}: {
  photo: WriteOffPhoto
  onRemove: () => void
  isRemoving: boolean
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imgError ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <ImageOff className="h-5 w-5 text-zinc-300" />
          <span className="px-1 text-center text-[9px] text-zinc-400 leading-tight">
            {photo.file.originalName}
          </span>
        </div>
      ) : (
        <img
          src={photoUrl(photo.file.id)}
          alt={photo.file.originalName}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          className="rounded-lg bg-red-600 p-1.5 text-white shadow hover:bg-red-700 disabled:opacity-50"
          aria-label="Remove photo"
        >
          {isRemoving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

export default function WriteOffDetailModal({
  isOpen,
  writeOff,
  isLoading,
  onClose,
  canApprove,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: Props) {
  const [photos, setPhotos] = useState<WriteOffPhoto[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)

  const rejectForm = useForm<RejectWriteOffFormValues>({
    resolver: zodResolver(RejectWriteOffFormSchema),
    defaultValues: { reason: '' },
  })

  useEffect(() => {
    if (!isOpen || !writeOff?.id) {
      setPhotos([])
      return
    }
    setIsLoadingPhotos(true)
    listWriteOffPhotos(writeOff.id).then((res) => {
      setPhotos(res.success && res.data ? res.data : [])
      setIsLoadingPhotos(false)
    })
  }, [writeOff?.id, isOpen])

  async function handleRemovePhoto(photo: WriteOffPhoto) {
    if (!writeOff?.id) return
    setRemovingId(photo.id)
    const result = await removeWriteOffPhoto(writeOff.id, photo.id)
    setRemovingId(null)
    if (result.success) {
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      showToast({ title: 'Photo removed', status: 'success' })
    } else {
      showToast({ title: 'Failed to remove photo', description: result.message, status: 'error' })
    }
  }

  async function handleApprove() {
    if (!writeOff) return
    const result = await onApprove(writeOff.id)
    if (result.success) setShowApproveConfirm(false)
  }

  async function handleRejectSubmit(data: RejectWriteOffFormValues) {
    if (!writeOff) return
    const result = await onReject(writeOff.id, data.reason)
    if (result.success) {
      setShowRejectForm(false)
      rejectForm.reset()
    }
  }

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  if (!isOpen) return null

  const statusCfg = writeOff?.writeOffStatus ? STATUS_CONFIG[writeOff.writeOffStatus] : null
  const StatusIcon = statusCfg?.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-prominent-purple-900">Write-off Detail</h2>
              {writeOff && (
                <p className="mt-0.5 font-mono text-xs text-zinc-400">
                  #{writeOff.id.slice(0, 8).toUpperCase()}
                </p>
              )}
            </div>
            {statusCfg && StatusIcon && (
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

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : writeOff ? (
            <div className="space-y-4">
              {/* Item + Warehouse */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Item</p>
                  <p className="mt-0.5 text-sm font-semibold text-prominent-purple-900">
                    {writeOff.item?.name ?? '—'}
                  </p>
                  {writeOff.item?.sku && (
                    <p className="font-mono text-xs text-zinc-400">{writeOff.item.sku}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Warehouse
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-prominent-purple-900">
                    {writeOff.warehouse?.name ?? '—'}
                  </p>
                  {writeOff.warehouse?.code && (
                    <p className="font-mono text-xs text-zinc-400">{writeOff.warehouse.code}</p>
                  )}
                </div>
              </div>

              {/* Quantity + Reason */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Quantity Written Off
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-prominent-purple-900">
                    {writeOff.quantity}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Reason
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    {REASON_CODE_LABELS[writeOff.reasonCode]}
                  </span>
                </div>
              </div>

              {/* Date + Created By */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Write-off Date
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-700">
                    {writeOff.writeOffDate
                      ? new Date(writeOff.writeOffDate).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
                {writeOff.createdBy && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Recorded By
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-700">{writeOff.createdBy.name}</p>
                  </div>
                )}
              </div>

              {/* Rejection reason — stays visible as history even after a later re-approval */}
              {writeOff.rejectedReason && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-xs font-medium text-red-500">
                    {writeOff.writeOffStatus === 'rejected'
                      ? 'Rejection Reason'
                      : 'Previous Rejection Reason'}
                  </p>
                  <p className="mt-0.5 text-sm text-red-800">{writeOff.rejectedReason}</p>
                </div>
              )}

              {/* Notes */}
              {writeOff.notes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Supporting Note
                  </p>
                  <p className="mt-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    {writeOff.notes}
                  </p>
                </div>
              )}

              {/* Photo Attachments */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Photo Evidence
                </p>

                {isLoadingPhotos ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    <span className="text-xs text-zinc-400">Loading photos…</span>
                  </div>
                ) : photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <PhotoThumbnail
                        key={photo.id}
                        photo={photo}
                        onRemove={() => handleRemovePhoto(photo)}
                        isRemoving={removingId === photo.id}
                      />
                    ))}
                  </div>
                ) : writeOff.photoUrl ? (
                  /* Legacy single-URL records */
                  <a
                    href={writeOff.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-prominent-purple-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View attached photo
                  </a>
                ) : (
                  <p className="text-xs text-zinc-400">No photos attached</p>
                )}
              </div>

              {/* Accounting Entry */}
              <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <div>
                  <p className="text-xs font-medium text-zinc-600">Accounting Entry</p>
                  {writeOff.accountingEntry ? (
                    <div className="mt-0.5 space-y-0.5">
                      {writeOff.accountingEntry.referenceNumber && (
                        <p className="font-mono text-xs text-zinc-500">
                          Ref: {writeOff.accountingEntry.referenceNumber}
                        </p>
                      )}
                      {writeOff.accountingEntry.accountName && (
                        <p className="text-xs text-zinc-500">
                          Account: {writeOff.accountingEntry.accountName}
                        </p>
                      )}
                      {writeOff.accountingEntry.amount != null && (
                        <p className="text-xs font-semibold text-red-600">
                          Loss:{' '}
                          {writeOff.accountingEntry.amount.toLocaleString('en-PH', {
                            style: 'currency',
                            currency: 'PHP',
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-400">Posted to Inventory Loss account</p>
                  )}
                </div>
              </div>

              {/* Timeline */}
              {writeOff.writeOffStatus && (
                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-700">Timeline</p>
                  <ol className="space-y-2">
                    <TimelineEvent
                      icon={<Clock className="h-3.5 w-3.5" />}
                      label="Recorded"
                      timestamp={writeOff.createdAt}
                      color="text-zinc-500 bg-zinc-100"
                    />
                    {writeOff.approvedAt && (
                      <TimelineEvent
                        icon={<CheckCircle className="h-3.5 w-3.5" />}
                        label="Approved"
                        timestamp={writeOff.approvedAt}
                        color="text-green-700 bg-green-100"
                      />
                    )}
                    {writeOff.rejectedAt && (
                      <TimelineEvent
                        icon={<XCircle className="h-3.5 w-3.5" />}
                        label="Rejected"
                        timestamp={writeOff.rejectedAt}
                        color="text-red-600 bg-red-100"
                      />
                    )}
                  </ol>
                </div>
              )}

              {/* Approve confirm */}
              {showApproveConfirm && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-800">
                    {writeOff.writeOffStatus === 'rejected'
                      ? 'Approve this write-off after all?'
                      : 'Approve this write-off?'}
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    {writeOff.writeOffStatus === 'rejected'
                      ? 'It was previously rejected, which put the stock back. Approving it now will deduct that stock again.'
                      : 'Stock was already deducted when it was recorded — this confirms the write-off stands.'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApproveConfirm(false)}
                      className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {isApproving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm Approval
                    </button>
                  </div>
                </div>
              )}

              {/* Reject form */}
              {showRejectForm && (
                <form
                  onSubmit={rejectForm.handleSubmit(handleRejectSubmit)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
                >
                  <p className="text-sm font-medium text-zinc-700">Reject Write-off</p>
                  {writeOff.writeOffStatus === 'approved' && (
                    <p className="text-xs text-zinc-500">
                      It was previously approved. Rejecting it now will reverse the stock deduction.
                    </p>
                  )}
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
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-400">No data available.</p>
          )}
        </div>

        {/* Footer actions */}
        {writeOff && !showApproveConfirm && !showRejectForm && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
            <div>
              {canApprove && writeOff.writeOffStatus !== 'rejected' && (
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  {writeOff.writeOffStatus === 'approved' ? 'Reject Instead' : 'Reject'}
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
              {canApprove && writeOff.writeOffStatus !== 'approved' && (
                <button
                  type="button"
                  onClick={() => setShowApproveConfirm(true)}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  {writeOff.writeOffStatus === 'rejected' ? 'Approve Instead' : 'Approve'}
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
