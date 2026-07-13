'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  CreateUdsFormSchema,
  type CreateUdsFormValues,
  UDS_REASONS,
  UDS_REASON_LABELS,
} from '@/src/schema/inventory/uds'
import type { ApiResponse } from '@/src/libs/api/client'

type WarehouseOption = { id: string; name: string; code: string }
type SerialOption = {
  id: string
  serialNumber: string
  item?: { sku: string; name: string } | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateUdsFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouseOptions: WarehouseOption[]
  serialOptions: SerialOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const defaultValues: CreateUdsFormValues = {
  warehouseId: '',
  reason: 'repair',
  expectedReturnDate: '',
  notes: '',
  lines: [{ serialNumberId: '', issueReason: '', notes: '' }],
}

export default function CreateUdsModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouseOptions,
  serialOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUdsFormValues>({
    resolver: zodResolver(CreateUdsFormSchema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  useEffect(() => {
    if (!isOpen) reset(defaultValues)
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateUdsFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Issue Unit Document Sheet</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Track units leaving the warehouse for repair, pull-out, or maintenance.
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
            {/* Reason + Warehouse */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={fieldClass}>
                      {UDS_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {UDS_REASON_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.reason && (
                  <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Warehouse</label>
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={fieldClass}>
                      <option value="">— None —</option>
                      {warehouseOptions.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} — {w.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            </div>

            {/* Expected Return Date */}
            <div className="sm:w-1/2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Expected Return Date
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="expectedReturnDate"
                control={control}
                render={({ field }) => <input {...field} type="date" className={fieldClass} />}
              />
            </div>

            {/* Units */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-800">Units</h3>
                <button
                  type="button"
                  onClick={() => append({ serialNumberId: '', issueReason: '', notes: '' })}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Unit
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <Controller
                          name={`lines.${idx}.serialNumberId`}
                          control={control}
                          render={({ field: f }) => (
                            <select {...f} className={fieldClass}>
                              <option value="">Select serial number…</option>
                              {serialOptions.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.serialNumber}
                                  {s.item ? ` — ${s.item.sku} ${s.item.name}` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        />
                        {errors.lines?.[idx]?.serialNumberId && (
                          <p className="text-xs text-red-600">
                            {errors.lines[idx]?.serialNumberId?.message}
                          </p>
                        )}
                        <Controller
                          name={`lines.${idx}.issueReason`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              type="text"
                              placeholder="Issue reason (optional)"
                              className={fieldClass}
                            />
                          )}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                        className="mt-1 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {errors.lines && !Array.isArray(errors.lines) && (
                <p className="mt-1 text-xs text-red-600">{errors.lines.message}</p>
              )}
            </div>

            {/* Notes */}
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
                    placeholder="Any additional instructions or context…"
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
              {isSubmitting ? 'Issuing…' : 'Issue UDS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
