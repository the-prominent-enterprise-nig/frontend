'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  CreateBatchFormSchema,
  type CreateBatchFormValues,
  BATCH_STATUS_LABELS,
} from '@/src/schema/inventory/batches'
import type { ApiResponse } from '@/src/libs/api/client'

type ItemOption = { id: string; name: string; sku: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateBatchFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  items: ItemOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function CreateBatchModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  items,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBatchFormValues>({
    resolver: zodResolver(CreateBatchFormSchema),
    defaultValues: { status: 'active' },
  })

  useEffect(() => {
    if (!isOpen) reset({ status: 'active' })
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateBatchFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Create Batch</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Register a new lot or batch for tracking.
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
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Item <span className="text-red-500">*</span>
              </label>
              <Controller
                name="itemId"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="">Select item…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.itemId && (
                <p className="mt-1 text-xs text-red-600">{errors.itemId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Batch Number <span className="text-red-500">*</span>
              </label>
              <Controller
                name="batchNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="BATCH-2026-001"
                    className={fieldClass}
                  />
                )}
              />
              {errors.batchNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.batchNumber.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Manufacture Date
                </label>
                <Controller
                  name="manufactureDate"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="date"
                      className={fieldClass}
                    />
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Expiry Date</label>
                <Controller
                  name="expiryDate"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="date"
                      className={fieldClass}
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    {(['active', 'quarantine', 'expired', 'recalled'] as const).map((s) => (
                      <option key={s} value={s}>
                        {BATCH_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                )}
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
              {isSubmitting ? 'Creating…' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
