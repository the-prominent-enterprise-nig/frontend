'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { CreateBsrFormSchema, CreateBsrFormValues } from '@/src/schema/inventory/stock-requisitions'
import type { ApiResponse } from '@/src/libs/api/client'

type Branch = { id: string; name: string }
type Warehouse = { id: string; name: string; code?: string }
type Item = { id: string; name: string; sku: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateBsrFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  branches: Branch[]
  warehouses: Warehouse[]
  items: Item[]
}

export default function CreateBsrModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  branches,
  warehouses,
  items,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBsrFormValues>({
    resolver: zodResolver(CreateBsrFormSchema),
    defaultValues: {
      lines: [{ itemId: '', requestedQty: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  useEffect(() => {
    if (!isOpen) reset({ lines: [{ itemId: '', requestedQty: 1 }] })
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateBsrFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-prominent-purple-900">
              New Stock Requisition
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Request stock from a warehouse to a branch.
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
            {/* Branch & Warehouse */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Branch <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="branchId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select branch…</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.branchId && (
                  <p className="mt-1 text-xs text-red-600">{errors.branchId.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  From Warehouse <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="fromWarehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select warehouse…</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.code ? `${wh.code} — ${wh.name}` : wh.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.fromWarehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.fromWarehouseId.message}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="Optional notes…"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Items <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => append({ itemId: '', requestedQty: 1 })}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </button>
              </div>

              {typeof errors.lines?.message === 'string' && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
              )}

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Controller
                          name={`lines.${index}.itemId`}
                          control={control}
                          render={({ field: f }) => (
                            <select {...f} className={`${fieldClass} bg-white`}>
                              <option value="">Select item…</option>
                              {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.sku} — {item.name}
                                </option>
                              ))}
                            </select>
                          )}
                        />
                        {errors.lines?.[index]?.itemId && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.lines[index].itemId?.message}
                          </p>
                        )}
                      </div>

                      <div className="w-28 shrink-0">
                        <Controller
                          name={`lines.${index}.requestedQty`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Qty"
                              className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                              onChange={(e) =>
                                f.onChange(e.target.value === '' ? '' : Number(e.target.value))
                              }
                            />
                          )}
                        />
                        {errors.lines?.[index]?.requestedQty && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.lines[index].requestedQty?.message}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => fields.length > 1 && remove(index)}
                        disabled={fields.length === 1}
                        className="mt-0.5 rounded p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Optional line notes */}
                    <div className="pl-0">
                      <Controller
                        name={`lines.${index}.notes`}
                        control={control}
                        render={({ field: f }) => (
                          <input
                            {...f}
                            type="text"
                            placeholder="Line notes (optional)…"
                            className={`${fieldClass} text-xs`}
                          />
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
              {isSubmitting ? 'Creating…' : 'Create Requisition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
