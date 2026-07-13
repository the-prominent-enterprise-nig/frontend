'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Ban } from 'lucide-react'
import {
  CancelPoSchema,
  type CancelPoValues,
  type PurchaseOrderSummary,
} from '@/src/schema/inventory/purchase-orders'

type Props = {
  open: boolean
  onClose: () => void
  po: Pick<PurchaseOrderSummary, 'id' | 'code' | 'status'> | null
  onCancel: (id: string, reason: string) => Promise<void>
  isCancelling?: boolean
}

export function CancelPoModal({ open, onClose, po, onCancel, isCancelling }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelPoValues>({
    resolver: zodResolver(CancelPoSchema),
    defaultValues: { reason: '' },
  })

  useEffect(() => {
    if (!open) {
      reset({ reason: '' })
    }
  }, [open, reset])

  async function handleFormSubmit(data: CancelPoValues) {
    if (!po) return
    await onCancel(po.id, data.reason)
    onClose()
  }

  if (!open || !po) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Cancel Purchase Order</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-4 px-6 py-4">
            {/* PO Summary */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-zinc-900">{po.code}</p>
              <p className="text-xs text-zinc-500">
                Status:{' '}
                <span className="font-medium capitalize text-zinc-700">
                  {po.status.replace(/_/g, ' ')}
                </span>
              </p>
            </div>

            {/* Cancellation Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('reason')}
                rows={4}
                placeholder="Provide a reason for cancelling this purchase order…"
                className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              type="submit"
              disabled={isCancelling}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCancelling ? 'Cancelling…' : 'Cancel Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
