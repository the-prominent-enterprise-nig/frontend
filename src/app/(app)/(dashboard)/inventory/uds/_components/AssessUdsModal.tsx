'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { X, Loader2, Check, Wrench, Ban, AlertTriangle } from 'lucide-react'
import {
  AssessUdsFormSchema,
  type AssessUdsFormValues,
  UDS_ASSESSMENT_LABELS,
  type Uds,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type AssessUdsFormInput = z.input<typeof AssessUdsFormSchema>

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const ASSESSMENT_META = {
  repairable: {
    icon: Wrench,
    description: 'Send to the repair provider — posts the estimated cost as a debit',
    color: 'bg-green-100 text-green-700',
    ring: 'border-green-500 ring-green-500',
  },
  unrepairable: {
    icon: Ban,
    description: 'Beyond economical repair — no cost posted here',
    color: 'bg-red-100 text-red-700',
    ring: 'border-red-500 ring-red-500',
  },
} as const

const defaultValues: AssessUdsFormInput = {
  assessment: 'repairable',
  estimatedCost: undefined,
  notes: '',
}

type Props = {
  uds: Uds | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: AssessUdsFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
}

export default function AssessUdsModal({ uds, isOpen, onClose, onSubmit, isSubmitting }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AssessUdsFormInput, unknown, AssessUdsFormValues>({
    resolver: zodResolver(AssessUdsFormSchema),
    defaultValues,
  })
  const assessment = watch('assessment')

  useEffect(() => {
    if (!isOpen) reset(defaultValues)
  }, [isOpen, reset])

  if (!isOpen || !uds) return null

  async function handleFormSubmit(data: AssessUdsFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Assess Repair Transfer</h2>
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
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Verdict <span className="text-red-500">*</span>
              </label>
              <Controller
                name="assessment"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    {(Object.keys(ASSESSMENT_META) as (keyof typeof ASSESSMENT_META)[]).map(
                      (key) => {
                        const meta = ASSESSMENT_META[key]
                        const Icon = meta.icon
                        const isSelected = field.value === key
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => field.onChange(key)}
                            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                              isSelected
                                ? `${meta.ring} ring-1 bg-zinc-50`
                                : 'border-zinc-200 hover:bg-zinc-50'
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.color}`}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-zinc-900">
                                {UDS_ASSESSMENT_LABELS[key]}
                              </span>
                              <span className="block text-xs text-zinc-500">
                                {meta.description}
                              </span>
                            </span>
                            {isSelected && (
                              <Check className="h-4 w-4 shrink-0 text-prominent-purple-700" />
                            )}
                          </button>
                        )
                      }
                    )}
                  </div>
                )}
              />
            </div>

            {assessment === 'repairable' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Estimated Repair Cost <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="estimatedCost"
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
                {errors.estimatedCost && (
                  <p className="mt-1 text-xs text-red-600">{errors.estimatedCost.message}</p>
                )}
                {!uds.repairProvider && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600" />
                    <p className="text-xs text-yellow-700">
                      No repair provider is on file for this UDS — the assessment will be rejected
                      until one is set.
                    </p>
                  </div>
                )}
              </div>
            )}

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
                    placeholder="Condition details, quote reference…"
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
              {isSubmitting ? 'Submitting…' : 'Confirm Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
