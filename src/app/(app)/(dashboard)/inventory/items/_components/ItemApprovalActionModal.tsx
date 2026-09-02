'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, CheckCircle } from 'lucide-react'
import {
  ApproveItemFormSchema,
  type ApproveItemFormValues,
  type ItemSummary,
} from '@/src/schema/inventory/items'

type Props = {
  open: boolean
  onClose: () => void
  item: ItemSummary | null
  title: string
  actionLabel: string
  onConfirm: (id: string, data: ApproveItemFormValues) => Promise<void>
  isSubmitting?: boolean
}

/**
 * Shared "optional remarks" confirmation modal for the two governance steps
 * that don't need a reason — Accounting confirming tax/GL mapping, and the
 * Master Data Approver's final publish (Scenario 16).
 */
export default function ItemApprovalActionModal({
  open,
  onClose,
  item,
  title,
  actionLabel,
  onConfirm,
  isSubmitting,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApproveItemFormValues>({
    resolver: zodResolver(ApproveItemFormSchema),
    defaultValues: { remarks: '' },
  })

  useEffect(() => {
    if (!open) reset({ remarks: '' })
  }, [open, reset])

  async function handleFormSubmit(data: ApproveItemFormValues) {
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
            <CheckCircle className="h-5 w-5 text-green-600" />
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
                    placeholder="Optional remarks…"
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
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? `${actionLabel}…` : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
