'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import { CreateUomFormSchema, CreateUomFormValues, UomRecord } from '@/src/schema/inventory/uom'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  isOpen: boolean
  editTarget: UomRecord | null
  onClose: () => void
  onSubmit: (data: CreateUomFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  baseUnits: UomRecord[]
}

export default function UomFormModal({
  isOpen,
  editTarget,
  onClose,
  onSubmit,
  isSubmitting,
  baseUnits,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateUomFormValues>({
    resolver: zodResolver(CreateUomFormSchema),
    defaultValues: {
      code: '',
      name: '',
      isBaseUnit: false,
      allowDecimal: false,
      baseUnitId: '',
      conversionFactor: undefined,
    },
  })

  const isBaseUnit = watch('isBaseUnit')

  useEffect(() => {
    if (isOpen && editTarget) {
      reset({
        code: editTarget.code,
        name: editTarget.name,
        isBaseUnit: editTarget.isBaseUnit ?? false,
        allowDecimal: editTarget.allowDecimal ?? false,
        baseUnitId: editTarget.baseUnitId ?? '',
        conversionFactor: editTarget.conversionFactor ?? undefined,
      })
    } else if (!isOpen) {
      reset()
    }
  }, [isOpen, editTarget, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateUomFormValues) {
    const result = await onSubmit({
      ...data,
      baseUnitId: data.isBaseUnit ? undefined : data.baseUnitId || undefined,
      conversionFactor: data.isBaseUnit ? undefined : data.conversionFactor,
    })
    if (result.success) onClose()
  }

  const isEdit = !!editTarget

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? 'Edit Unit of Measure' : 'New Unit of Measure'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit
                ? 'Update the unit definition and conversion factor.'
                : 'Define a base unit or an alternate unit with a conversion rate.'}
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
          <div className="grid gap-4 px-6 py-5">
            {/* Unit Type toggle */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">Unit Type</label>
              <Controller
                name="isBaseUnit"
                control={control}
                render={({ field }) => (
                  <div className="flex rounded-lg border border-zinc-200 p-1">
                    <button
                      type="button"
                      onClick={() => field.onChange(false)}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                        !field.value
                          ? 'bg-prominent-purple-700 text-white shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Alternate Unit
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange(true)}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                        field.value
                          ? 'bg-prominent-purple-700 text-white shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Base Unit
                    </button>
                  </div>
                )}
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                {isBaseUnit
                  ? 'Base units are the reference measurement (e.g. Each, Kg, Litre).'
                  : 'Alternate units convert to a base unit (e.g. Case = 12 × Each).'}
              </p>
            </div>

            {/* Code */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Code <span className="text-red-500">*</span>
              </label>
              <Controller
                name="code"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. EA, KG, CS"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm uppercase outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                )}
              />
              {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
            </div>

            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Each, Kilogram, Case of 12"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            {/* Allow decimal */}
            <Controller
              name="allowDecimal"
              control={control}
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="accent-prominent-purple-600"
                  />
                  <span>
                    Allow decimal quantities
                    <span className="ml-1.5 text-xs text-zinc-400">(e.g. 0.5 kg, 1.25 L)</span>
                  </span>
                </label>
              )}
            />

            {/* Derived unit fields */}
            {!isBaseUnit && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Base Unit <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="baseUnitId"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      >
                        <option value="">Select base unit…</option>
                        {baseUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code} — {u.name}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  {errors.baseUnitId && (
                    <p className="mt-1 text-xs text-red-600">{errors.baseUnitId.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Conversion Factor <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="conversionFactor"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="number"
                        min="0.0001"
                        step="any"
                        placeholder="e.g. 12 for a case of 12 eaches"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                        }
                      />
                    )}
                  />
                  {errors.conversionFactor && (
                    <p className="mt-1 text-xs text-red-600">{errors.conversionFactor.message}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">
                    How many base units equal 1 of this unit. Example: 1 Case = 12 Each → enter 12.
                  </p>
                </div>
              </>
            )}
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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
