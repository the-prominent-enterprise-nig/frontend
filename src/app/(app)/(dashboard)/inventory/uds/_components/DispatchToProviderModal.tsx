'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { X, Loader2, Truck } from 'lucide-react'
import {
  DispatchToProviderFormSchema,
  type DispatchToProviderFormValues,
  type Uds,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type DispatchToProviderFormInput = z.input<typeof DispatchToProviderFormSchema>

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const defaultValues: DispatchToProviderFormInput = {
  deliveryReceiptNumber: '',
  notes: '',
}

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: DispatchToProviderFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
}

/**
 * The outbound leg: the unit physically leaves for the repair provider on a DR.
 * Posts nothing — what the repair is expected to cost was already recognised
 * at assessment, and handing over a unit we still own is not a transaction.
 */
export default function DispatchToProviderModal({
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
  } = useForm<DispatchToProviderFormInput, unknown, DispatchToProviderFormValues>({
    resolver: zodResolver(DispatchToProviderFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!isOpen) reset(defaultValues)
  }, [isOpen, reset])

  if (!isOpen || !uds) return null

  async function handleFormSubmit(data: DispatchToProviderFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Send to Service Centre</h2>
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
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                The unit goes to{' '}
                <span className="font-medium">{uds.repairProvider?.name ?? 'the provider'}</span>{' '}
                but stays ours — it will show as held by them until you receive it back. Nothing is
                posted to the ledger here; the estimated cost was recorded at assessment.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                DR Number <span className="text-red-500">*</span>
              </label>
              <Controller
                name="deliveryReceiptNumber"
                control={control}
                render={({ field }) => (
                  <input {...field} placeholder="DR-000123" className={fieldClass} />
                )}
              />
              <p className="mt-1 text-xs text-zinc-400">
                The delivery receipt that goes out with the unit.
              </p>
              {errors.deliveryReceiptNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.deliveryReceiptNumber.message}</p>
              )}
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
                    placeholder="Courier, contact person…"
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
              {isSubmitting ? 'Sending…' : 'Send to Service Centre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
