'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  ScheduleCycleCountFormSchema,
  type ScheduleCycleCountFormValues,
} from '@/src/schema/inventory/cycle-counts'
import type { ApiResponse } from '@/src/libs/api/client'

type WarehouseOption = { id: string; name: string; code: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ScheduleCycleCountFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function ScheduleCountModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleCycleCountFormValues>({
    resolver: zodResolver(ScheduleCycleCountFormSchema),
    defaultValues: { scheduledDate: new Date().toISOString().slice(0, 10) },
  })

  useEffect(() => {
    if (!isOpen) reset({ scheduledDate: new Date().toISOString().slice(0, 10) })
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: ScheduleCycleCountFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Schedule Cycle Count</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Set up a recurring cycle count for a warehouse.
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
                Warehouse <span className="text-red-500">*</span>
              </label>
              <Controller
                name="warehouseId"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="">Select warehouse…</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} — {wh.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.warehouseId && (
                <p className="mt-1 text-xs text-red-600">{errors.warehouseId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Scheduled Date <span className="text-red-500">*</span>
              </label>
              <Controller
                name="scheduledDate"
                control={control}
                render={({ field }) => <input {...field} type="date" className={fieldClass} />}
              />
              {errors.scheduledDate && (
                <p className="mt-1 text-xs text-red-600">{errors.scheduledDate.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Notes <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                    placeholder="Additional instructions for counters…"
                    className={`${fieldClass} resize-none`}
                  />
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
              {isSubmitting ? 'Scheduling…' : 'Schedule Count'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
