'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, XCircle } from 'lucide-react'
import {
  RejectItemFormSchema,
  type RejectItemFormValues,
  type ItemSummary,
} from '@/src/schema/inventory/items'

type Props = {
  open: boolean
  onClose: () => void
  item: ItemSummary | null
  title: string
  onConfirm: (id: string, data: RejectItemFormValues) => Promise<void>
  isSubmitting?: boolean
}

/**
 * Shared "required reason" rejection modal for both governance reject
 * points — Accounting rejecting a submitted item, and the Master Data
 * Approver's final reject (Scenario 16).
 */
export default function ItemRejectModal({
  open,
  onClose,
  item,
  title,
  onConfirm,
  isSubmitting,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectItemFormValues>({
    resolver: zodResolver(RejectItemFormSchema),
    defaultValues: { reason: '' },
  })

  useEffect(() => {
    if (!open) reset({ reason: '' })
  }, [open, reset])

  async function handleFormSubmit(data: RejectItemFormValues) {
    if (!item) return
    await onConfirm(item.id, data)
    onClose()
  }

  if (!open || !item) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="px-6 py-4 space-y-4">
            {/* Item Info */}
            <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-zinc-900">{item.name}</p>
              <p className="font-mono text-xs text-zinc-500">{item.sku}</p>
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
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
