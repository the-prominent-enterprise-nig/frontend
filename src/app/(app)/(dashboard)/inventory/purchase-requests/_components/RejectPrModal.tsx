'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, XCircle } from 'lucide-react'
import {
  RejectPrFormSchema,
  type RejectPrFormValues,
  type PurchaseRequestSummary,
} from '@/src/schema/inventory/purchase-requests'

type Props = {
  open: boolean
  onClose: () => void
  pr: PurchaseRequestSummary | null
  onReject: (id: string, data: RejectPrFormValues) => Promise<void>
  isRejecting?: boolean
}

export function RejectPrModal({ open, onClose, pr, onReject, isRejecting }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectPrFormValues>({
    resolver: zodResolver(RejectPrFormSchema),
    defaultValues: { reason: '' },
  })

  useEffect(() => {
    if (!open) {
      reset({ reason: '' })
    }
  }, [open, reset])

  async function handleFormSubmit(data: RejectPrFormValues) {
    if (!pr) return
    await onReject(pr.id, data)
    onClose()
  }

  if (!open || !pr) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Reject Purchase Request</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRejecting}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="px-6 py-4 space-y-4">
            {/* PR Info */}
            <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-zinc-900">{pr.code}</p>
              {pr.reason && (
                <p className="text-xs text-zinc-500">
                  Reason: <span className="text-zinc-700">{pr.reason}</span>
                </p>
              )}
              <p className="text-xs text-zinc-500">
                {pr.lines.length} line{pr.lines.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Rejection Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    placeholder="Provide a reason for rejection…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                  />
                )}
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isRejecting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRejecting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isRejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRejecting ? 'Rejecting…' : 'Reject Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
