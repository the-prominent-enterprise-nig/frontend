'use client'

import { useEffect } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { X, Loader2, PackageCheck } from 'lucide-react'
import {
  ReceiveFromProviderFormSchema,
  type ReceiveFromProviderFormValues,
  type Uds,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type ReceiveFromProviderFormInput = z.input<typeof ReceiveFromProviderFormSchema>

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const defaultValues: ReceiveFromProviderFormInput = {
  receivingReportNumber: '',
  actualCost: undefined,
  notes: '',
}

const peso = (n: number): string =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReceiveFromProviderFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
}

/**
 * The return leg: the repaired unit comes back on an RR and the real cost is
 * known. Shows the variance against the estimate as it is typed, because that
 * difference is posted — the payable has to end up carrying what we actually
 * owe, since that is the balance the provider's bill settles against.
 */
export default function ReceiveFromProviderModal({
  uds,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReceiveFromProviderFormInput, unknown, ReceiveFromProviderFormValues>({
    resolver: zodResolver(ReceiveFromProviderFormSchema),
    defaultValues,
  })

  const typedCost = useWatch({ control, name: 'actualCost' })

  useEffect(() => {
    if (!isOpen) reset(defaultValues)
  }, [isOpen, reset])

  if (!isOpen || !uds) return null

  const estimated = Number(uds.repairEstimatedCost ?? 0)
  const actual = Number(typedCost) || 0
  const variance = actual ? Math.round((actual - estimated) * 100) / 100 : 0

  async function handleFormSubmit(data: ReceiveFromProviderFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Receive from Service Centre</h2>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">{uds.code}</p>
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
          <div className="space-y-4 px-6 py-5">
            <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3">
              <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              <p className="text-xs text-teal-800">
                The unit returns to stock and becomes sellable again.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                RR Number <span className="text-red-500">*</span>
              </label>
              <Controller
                name="receivingReportNumber"
                control={control}
                render={({ field }) => (
                  <input {...field} placeholder="RR-000123" className={fieldClass} />
                )}
              />
              {errors.receivingReportNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.receivingReportNumber.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Actual Cost <span className="text-red-500">*</span>
              </label>
              <Controller
                name="actualCost"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={(field.value as number | string | undefined) ?? ''}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={fieldClass}
                  />
                )}
              />
              {errors.actualCost && (
                <p className="mt-1 text-xs text-red-600">{errors.actualCost.message}</p>
              )}
            </div>

            {/* What the difference will actually do, before it is committed. */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Estimated at assessment</span>
                <span className="tabular-nums">{peso(estimated)}</span>
              </div>
              <div className="mt-1 flex justify-between font-medium text-zinc-800">
                <span>{variance === 0 ? 'No variance' : variance > 0 ? 'Overrun' : 'Saving'}</span>
                <span className="tabular-nums">
                  {variance === 0 ? '—' : peso(Math.abs(variance))}
                </span>
              </div>
              <p className="mt-2 text-zinc-500">
                {variance === 0
                  ? 'Matching the estimate posts no entry at all.'
                  : variance > 0
                    ? 'The overrun is added to repair expense and to what we owe the provider.'
                    : 'The saving reverses part of the accrual and reduces what we owe.'}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Notes
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="What was replaced, warranty terms…"
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
              {isSubmitting ? 'Receiving…' : 'Receive Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
