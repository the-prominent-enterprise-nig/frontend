'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import {
  WriteOffUdsFormSchema,
  type WriteOffUdsFormValues,
  type Uds,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type WriteOffUdsFormInput = z.input<typeof WriteOffUdsFormSchema>

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const defaultValues: WriteOffUdsFormInput = {
  unitCost: undefined,
  notes: '',
}

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: WriteOffUdsFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
}

export default function WriteOffUdsModal({ uds, isOpen, onClose, onSubmit, isSubmitting }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WriteOffUdsFormInput, unknown, WriteOffUdsFormValues>({
    resolver: zodResolver(WriteOffUdsFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!isOpen) reset(defaultValues)
  }, [isOpen, reset])

  if (!isOpen || !uds) return null

  async function handleFormSubmit(data: WriteOffUdsFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Write Off Unit</h2>
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
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs text-red-700">
                This posts a permanent stock adjustment (Dr Expense / Cr Inventory Asset) and marks
                the unit scrapped. It cannot be undone from here.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Unit Cost <span className="text-red-500">*</span>
              </label>
              <Controller
                name="unitCost"
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
              {errors.unitCost && (
                <p className="mt-1 text-xs text-red-600">{errors.unitCost.message}</p>
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
                    placeholder="Disposal details…"
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
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Writing off…' : 'Confirm Write Off'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
