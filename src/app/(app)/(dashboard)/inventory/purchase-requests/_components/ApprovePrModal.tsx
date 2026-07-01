'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, CheckCircle } from 'lucide-react'
import {
  ApprovePrFormSchema,
  type ApprovePrFormValues,
  type PurchaseRequestSummary,
} from '@/src/schema/inventory/purchase-requests'

type Props = {
  open: boolean
  onClose: () => void
  pr: PurchaseRequestSummary | null
  onApprove: (id: string, data: ApprovePrFormValues) => Promise<void>
  isApproving?: boolean
}

export function ApprovePrModal({ open, onClose, pr, onApprove, isApproving }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApprovePrFormValues>({
    resolver: zodResolver(ApprovePrFormSchema),
    defaultValues: { remarks: '' },
  })

  useEffect(() => {
    if (!open) {
      reset({ remarks: '' })
    }
  }, [open, reset])

  const pendingApproval = pr?.approvals.find((a) => a.status === 'pending')

  async function handleFormSubmit(data: ApprovePrFormValues) {
    if (!pr) return
    await onApprove(pr.id, data)
    onClose()
  }

  if (!open || !pr) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Approve Purchase Request</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApproving}
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
              {pendingApproval && (
                <p className="text-xs text-zinc-500">
                  Pending tier:{' '}
                  <span className="font-medium text-zinc-700">{pendingApproval.label}</span>
                </p>
              )}
              {pr.reason && (
                <p className="text-xs text-zinc-500">
                  Reason: <span className="text-zinc-700">{pr.reason}</span>
                </p>
              )}
              <p className="text-xs text-zinc-500">
                {pr.lines.length} line{pr.lines.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Remarks */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Remarks <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <Controller
                name="remarks"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={3}
                    placeholder="Optional approval remarks…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.remarks && (
                <p className="mt-1 text-xs text-red-600">{errors.remarks.message}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isApproving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isApproving}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isApproving ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
