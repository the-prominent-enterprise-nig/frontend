'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { LandedCostFormSchema, type LandedCostFormValues } from '@/src/schema/inventory/landed-cost'
import type { ApiResponse } from '@/src/libs/api/client'

type GoodsReceiptOption = { id: string; code?: string | null; receiptNumber?: string | null }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: LandedCostFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  goodsReceipts: GoodsReceiptOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const defaultLine = { componentType: 'freight' as const, amount: 0, vendorId: '', notes: '' }

export default function LandedCostModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  goodsReceipts,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LandedCostFormValues>({
    resolver: zodResolver(LandedCostFormSchema),
    defaultValues: {
      goodsReceiptId: '',
      allocationMethod: 'by_quantity',
      notes: '',
      lines: [{ ...defaultLine }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  useEffect(() => {
    if (!isOpen) {
      reset({
        goodsReceiptId: '',
        allocationMethod: 'by_quantity',
        notes: '',
        lines: [{ ...defaultLine }],
      })
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: LandedCostFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Record Landed Cost</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Add freight, duty, and other costs to a goods receipt.
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
                Goods Receipt <span className="text-red-500">*</span>
              </label>
              <Controller
                name="goodsReceiptId"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="">Select goods receipt…</option>
                    {goodsReceipts.map((gr) => (
                      <option key={gr.id} value={gr.id}>
                        {gr.code ?? gr.receiptNumber ?? gr.id}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.goodsReceiptId && (
                <p className="mt-1 text-xs text-red-600">{errors.goodsReceiptId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Allocation Method <span className="text-red-500">*</span>
              </label>
              <Controller
                name="allocationMethod"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="by_quantity">By Quantity</option>
                    <option value="by_value">By Value</option>
                    <option value="by_weight">By Weight</option>
                  </select>
                )}
              />
              {errors.allocationMethod && (
                <p className="mt-1 text-xs text-red-600">{errors.allocationMethod.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Notes <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Any relevant notes…"
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
            </div>

            {/* Cost Lines */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-700">
                  Cost Lines <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => append({ ...defaultLine })}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </button>
              </div>

              {errors.lines && !Array.isArray(errors.lines) && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Line {index + 1}
                      </span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Component Type
                        </label>
                        <Controller
                          name={`lines.${index}.componentType`}
                          control={control}
                          render={({ field: f }) => (
                            <select {...f} className={`${fieldClass} bg-white text-xs`}>
                              <option value="freight">Freight</option>
                              <option value="duty">Duty</option>
                              <option value="insurance">Insurance</option>
                              <option value="broker">Broker</option>
                              <option value="other">Other</option>
                            </select>
                          )}
                        />
                        {errors.lines?.[index]?.componentType && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.lines[index]?.componentType?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Amount <span className="text-red-500">*</span>
                        </label>
                        <Controller
                          name={`lines.${index}.amount`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="0.00"
                              className={`${fieldClass} text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                f.onChange(e.target.value === '' ? '' : Number(e.target.value))
                              }
                            />
                          )}
                        />
                        {errors.lines?.[index]?.amount && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.lines[index]?.amount?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Vendor ID{' '}
                          <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                        </label>
                        <Controller
                          name={`lines.${index}.vendorId`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              type="text"
                              placeholder="Vendor ID…"
                              className={`${fieldClass} text-xs`}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Notes{' '}
                          <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                        </label>
                        <Controller
                          name={`lines.${index}.notes`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              type="text"
                              placeholder="Notes…"
                              className={`${fieldClass} text-xs`}
                            />
                          )}
                        />
                      </div>
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
              {isSubmitting ? 'Saving…' : 'Record Landed Cost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
