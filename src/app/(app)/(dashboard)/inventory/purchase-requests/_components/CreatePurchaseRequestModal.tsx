'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  CreatePurchaseRequestFormSchema,
  type CreatePurchaseRequestFormValues,
} from '@/src/schema/inventory/purchase-requests'
import { ItemSearchCombobox } from './ItemSearchCombobox'
import { NumericInput } from '@/src/app/(app)/(dashboard)/inventory/items/_components/item-form-shared'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (data: CreatePurchaseRequestFormValues) => Promise<void>
  isCreating?: boolean
}

export function CreatePurchaseRequestModal({ open, onClose, onCreate, isCreating }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePurchaseRequestFormValues>({
    resolver: zodResolver(CreatePurchaseRequestFormSchema),
    defaultValues: {
      reason: '',
      notes: '',
      lines: [{ itemId: '', quantity: 1, suggestedSupplierId: '', notes: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  useEffect(() => {
    if (!open) {
      reset({
        reason: '',
        notes: '',
        lines: [
          {
            itemId: '',
            quantity: 1,
            estimatedUnitPrice: undefined,
            suggestedSupplierId: '',
            notes: '',
          },
        ],
      })
    }
  }, [open, reset])

  async function handleFormSubmit(data: CreatePurchaseRequestFormValues) {
    await onCreate(data)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">New Purchase Request</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Fill in the details below to create a purchase request
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="px-6 py-4 space-y-4">
            {/* Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reason</label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                    placeholder="Reason for this purchase request…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                    placeholder="Additional notes…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
            </div>

            {/* Line Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Line Items <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    append({
                      itemId: '',
                      quantity: 1,
                      estimatedUnitPrice: undefined,
                      suggestedSupplierId: '',
                      notes: '',
                    })
                  }
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3 w-3" />
                  Add Line
                </button>
              </div>

              {errors.lines && !Array.isArray(errors.lines) && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                        Line {index + 1}
                      </span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Item Search */}
                      <div className="col-span-2">
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Item <span className="text-red-500">*</span>
                        </label>
                        <Controller
                          name={`lines.${index}.itemId`}
                          control={control}
                          render={({ field: f }) => (
                            <ItemSearchCombobox
                              value={f.value}
                              onChange={f.onChange}
                              error={errors.lines?.[index]?.itemId?.message}
                            />
                          )}
                        />
                        {errors.lines?.[index]?.itemId && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.lines[index]?.itemId?.message}
                          </p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <Controller
                          name={`lines.${index}.quantity`}
                          control={control}
                          render={({ field: f }) => (
                            <NumericInput
                              integer
                              value={f.value}
                              onChange={(v) => f.onChange(v ?? 0)}
                              onBlur={f.onBlur}
                              placeholder="0"
                              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${errors.lines?.[index]?.quantity ? 'border-red-400' : 'border-zinc-200'}`}
                            />
                          )}
                        />
                        {errors.lines?.[index]?.quantity && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.lines[index]?.quantity?.message}
                          </p>
                        )}
                      </div>

                      {/* Estimated Unit Price */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Estimated Unit Price
                        </label>
                        <Controller
                          name={`lines.${index}.estimatedUnitPrice`}
                          control={control}
                          render={({ field: f }) => (
                            <NumericInput
                              value={f.value ?? undefined}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                            />
                          )}
                        />
                      </div>

                      {/* Suggested Supplier */}
                      <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Suggested Supplier ID
                        </label>
                        <Controller
                          name={`lines.${index}.suggestedSupplierId`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              value={f.value ?? ''}
                              type="text"
                              placeholder="Optional supplier ID"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                            />
                          )}
                        />
                      </div>

                      {/* Line Notes */}
                      <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Line Notes
                        </label>
                        <Controller
                          name={`lines.${index}.notes`}
                          control={control}
                          render={({ field: f }) => (
                            <input
                              {...f}
                              value={f.value ?? ''}
                              type="text"
                              placeholder="Optional notes for this line"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating ? 'Creating…' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
