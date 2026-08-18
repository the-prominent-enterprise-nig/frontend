'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  PriceUseTypeFormSchema,
  type PriceUseTypeFormValues,
  type PriceUseType,
} from '@/src/schema/inventory/price-use-types'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PriceUseTypeFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  initial?: PriceUseType
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const EMPTY_VALUES: PriceUseTypeFormValues = { name: '', description: '' }

function toFormValues(type?: PriceUseType): PriceUseTypeFormValues {
  if (!type) return EMPTY_VALUES
  return { name: type.name, description: type.description ?? '' }
}

export default function PriceUseTypeModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initial,
}: Props) {
  const isEdit = Boolean(initial)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceUseTypeFormValues>({
    resolver: zodResolver(PriceUseTypeFormSchema),
    defaultValues: toFormValues(initial),
  })

  useEffect(() => {
    reset(isOpen ? toFormValues(initial) : EMPTY_VALUES)
  }, [isOpen, initial, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: PriceUseTypeFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? 'Edit Price Use Type' : 'New Price Use Type'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit
                ? 'Rename this price-use category.'
                : 'Add a new price-use category, e.g. WIP, CR-BR, SSC.'}
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
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <input {...field} type="text" placeholder="e.g. SSC" className={fieldClass} />
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Description{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="e.g. Special Spot Cash"
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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
