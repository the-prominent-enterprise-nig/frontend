'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { CreateSalesQuotaSchema } from '@/src/schema/pos/sales-quotas'
import type { CreateSalesQuotaValues } from '@/src/schema/pos/sales-quotas'

type Props = {
  onClose: () => void
  onSubmit: (data: CreateSalesQuotaValues) => Promise<any>
  isSubmitting: boolean
}

const GRAIN_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
] as const

export function CreateQuotaModal({ onClose, onSubmit, isSubmitting }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateSalesQuotaValues>({
    resolver: zodResolver(CreateSalesQuotaSchema),
    defaultValues: { fiscalYear: new Date().getFullYear(), grain: 'annual' },
  })

  const handleFormSubmit = async (data: CreateSalesQuotaValues) => {
    const result = await onSubmit(data)
    if (result?.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-prominent-purple-900">New Sales Target</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 px-6 py-5">
          {/* Period grain */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Period</label>
            <Controller
              name="grain"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2">
                  {GRAIN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        field.value === opt.value
                          ? 'border-prominent-purple-600 bg-prominent-purple-50 text-prominent-purple-700'
                          : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            />
            {errors.grain && <p className="mt-1 text-xs text-red-600">{errors.grain.message}</p>}
          </div>

          {/* Fiscal Year */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Fiscal Year</label>
            <input
              {...register('fiscalYear', { valueAsNumber: true })}
              type="number"
              min={2020}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-400 focus:outline-none focus:ring-2 focus:ring-prominent-purple-100"
              placeholder="e.g. 2026"
            />
            {errors.fiscalYear && (
              <p className="mt-1 text-xs text-red-600">{errors.fiscalYear.message}</p>
            )}
          </div>

          {/* Target Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Sales Target (₱)
            </label>
            <input
              {...register('targetAmount', { valueAsNumber: true })}
              type="number"
              min={1}
              step="0.01"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-400 focus:outline-none focus:ring-2 focus:ring-prominent-purple-100"
              placeholder="e.g. 500000"
            />
            {errors.targetAmount && (
              <p className="mt-1 text-xs text-red-600">{errors.targetAmount.message}</p>
            )}
          </div>

          {/* Branch (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Branch ID{' '}
              <span className="font-normal text-zinc-400">(leave empty for tenant-wide)</span>
            </label>
            <input
              {...register('branchId')}
              type="text"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-400 focus:outline-none focus:ring-2 focus:ring-prominent-purple-100"
              placeholder="Branch ID (optional)"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Notes <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-400 focus:outline-none focus:ring-2 focus:ring-prominent-purple-100"
              placeholder="Any notes about this target..."
            />
            {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
