'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  BackorderUpdateFormSchema,
  type BackorderUpdateFormValues,
} from '@/src/schema/inventory/backorders'
import type { ApiResponse } from '@/src/libs/api/client'
import type { Backorder } from '@/src/schema/inventory/backorders'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: BackorderUpdateFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  backorder: Backorder | null
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function BackorderUpdateModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  backorder,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BackorderUpdateFormValues>({
    resolver: zodResolver(BackorderUpdateFormSchema),
    defaultValues: {
      expectedFulfillAt: '',
      status: 'pending',
    },
  })

  useEffect(() => {
    if (backorder && isOpen) {
      reset({
        expectedFulfillAt: backorder.expectedFulfillAt ?? '',
        status: backorder.status,
      })
    } else if (!isOpen) {
      reset({ expectedFulfillAt: '', status: 'pending' })
    }
  }, [isOpen, backorder, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: BackorderUpdateFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Update Backorder</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Update the status or expected fulfillment date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-5 px-6 py-5">
            {backorder && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                <p>
                  <span className="font-medium text-zinc-800">Item:</span>{' '}
                  {backorder.item?.name ?? backorder.itemId}
                </p>
                <p className="mt-0.5">
                  <span className="font-medium text-zinc-800">Order:</span> {backorder.salesOrderId}
                </p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="pending">Pending</option>
                    <option value="partially_fulfilled">Partially Fulfilled</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                )}
              />
              {errors.status && (
                <p className="mt-1 text-xs text-red-600">{errors.status.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Expected Fulfil At{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="expectedFulfillAt"
                control={control}
                render={({ field }) => <input {...field} type="date" className={fieldClass} />}
              />
            </div>
          </div>

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
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : 'Update Backorder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
