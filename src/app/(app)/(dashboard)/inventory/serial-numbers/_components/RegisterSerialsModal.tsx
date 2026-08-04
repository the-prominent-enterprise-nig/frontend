'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  RegisterSerialsFormInputSchema,
  type RegisterSerialsFormInput,
} from '@/src/schema/inventory/serial-numbers'
import type { ApiResponse } from '@/src/libs/api/client'

type ItemOption = { id: string; name: string; sku: string }
type WarehouseOption = { id: string; name: string; code: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: RegisterSerialsFormInput) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  items: ItemOption[]
  warehouses: WarehouseOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function RegisterSerialsModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  items,
  warehouses,
}: Props) {
  const [parsedCount, setParsedCount] = useState(0)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RegisterSerialsFormInput>({
    resolver: zodResolver(RegisterSerialsFormInputSchema),
    defaultValues: { serialNumbersText: '' },
  })

  const text = watch('serialNumbersText')

  useEffect(() => {
    const count = text
      ? text
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean).length
      : 0
    setParsedCount(count)
  }, [text])

  useEffect(() => {
    if (!isOpen) reset({ serialNumbersText: '' })
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: RegisterSerialsFormInput) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Register Serial Numbers</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Enter one per line, or comma-separated. Paste bulk input.
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
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Serial Numbers <span className="text-red-500">*</span>
                </label>
                {parsedCount > 0 && (
                  <span className="text-xs font-medium text-prominent-purple-600">
                    {parsedCount} detected
                  </span>
                )}
              </div>
              <Controller
                name="serialNumbersText"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={8}
                    placeholder="SN-001&#10;SN-002&#10;SN-003&#10;&#10;Or paste comma-separated: SN-001, SN-002, SN-003"
                    className={`${fieldClass} resize-none font-mono text-xs`}
                  />
                )}
              />
              {errors.serialNumbersText && (
                <p className="mt-1 text-xs text-red-600">{errors.serialNumbersText.message}</p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                Duplicates will be rejected. Serial count must match received quantity.
              </p>
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
              disabled={isSubmitting || parsedCount === 0}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting
                ? 'Registering…'
                : `Register ${parsedCount || ''} Serial${parsedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
