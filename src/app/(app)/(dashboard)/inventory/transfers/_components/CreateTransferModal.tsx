'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  CreateTransferFormSchema,
  CreateTransferFormValues,
} from '@/src/schema/inventory/transfers'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import type { ApiResponse } from '@/src/libs/api/client'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTransferFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseSummary[]
  items: ItemSummary[]
}

export default function CreateTransferModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  items,
}: Props) {
  const today = new Date().toISOString().split('T')[0]

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<CreateTransferFormValues>({
    resolver: zodResolver(CreateTransferFormSchema),
    defaultValues: {
      transferDate: today,
      lines: [{ itemId: '', quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const fromId = watch('fromWarehouseId')

  const [serialOptions, setSerialOptions] = useState<Record<string, SerialNumberSummary[]>>({})
  const [serialLoading, setSerialLoading] = useState<Record<string, boolean>>({})

  function isSerialTracked(itemId: string): boolean {
    return !!items.find((item) => item.id === itemId)?.isSerialTracked
  }

  const loadSerials = useCallback(async (fieldId: string, itemId: string, warehouseId: string) => {
    if (!itemId || !warehouseId) {
      setSerialOptions((prev) => ({ ...prev, [fieldId]: [] }))
      return
    }
    setSerialLoading((prev) => ({ ...prev, [fieldId]: true }))
    const result = await getSerialNumbers({ itemId, warehouseId, status: 'in_stock', limit: 100 })
    setSerialOptions((prev) => ({
      ...prev,
      [fieldId]: result.success ? (result.data?.data ?? []) : [],
    }))
    setSerialLoading((prev) => ({ ...prev, [fieldId]: false }))
  }, [])

  useEffect(() => {
    if (!isOpen) {
      reset({ transferDate: today, lines: [{ itemId: '', quantity: 1 }] })
      setSerialOptions({})
      setSerialLoading({})
    }
  }, [isOpen, reset, today])

  useEffect(() => {
    fields.forEach((field, index) => {
      const itemId = getValues(`lines.${index}.itemId`)
      if (itemId && isSerialTracked(itemId)) {
        setValue(`lines.${index}.serialNumberId`, '')
        loadSerials(field.id, itemId, fromId)
      }
    })
    // Re-check available serials whenever the source warehouse changes — a serial
    // valid at the previous source is not necessarily valid at the new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateTransferFormValues) {
    const missingSerialIndex = data.lines.findIndex(
      (line) => isSerialTracked(line.itemId) && !line.serialNumberId
    )
    if (missingSerialIndex !== -1) {
      setError(`lines.${missingSerialIndex}.serialNumberId`, {
        message: 'Select a serial number for this serial-tracked item',
      })
      return
    }
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  function handleItemChange(index: number, fieldId: string, itemId: string): void {
    setValue(`lines.${index}.serialNumberId`, '')
    if (isSerialTracked(itemId)) {
      setValue(`lines.${index}.quantity`, 1)
      loadSerials(fieldId, itemId, fromId)
    } else {
      setSerialOptions((prev) => ({ ...prev, [fieldId]: [] }))
    }
  }

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">New Stock Transfer</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Saved as draft — dispatch when ready to move stock.
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
            {/* Warehouses */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  From Warehouse <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="fromWarehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select source…</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.code} — {wh.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.fromWarehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.fromWarehouseId.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  To Warehouse <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="toWarehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select destination…</option>
                      {warehouses
                        .filter((wh) => wh.id !== fromId)
                        .map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.code} — {wh.name}
                          </option>
                        ))}
                    </select>
                  )}
                />
                {errors.toWarehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.toWarehouseId.message}</p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="transferDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {errors.transferDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.transferDate.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Expected Arrival
                </label>
                <Controller
                  name="expectedArrival"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reason</label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Rebalancing stock for upcoming campaign"
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
                  onClick={() => append({ itemId: '', quantity: 1 })}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </button>
              </div>

              {errors.lines?.root && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.root.message}</p>
              )}
              {typeof errors.lines?.message === 'string' && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
              )}

              <div className="space-y-2">
                {fields.map((field, index) => {
                  const lineItemId = watch(`lines.${index}.itemId`)
                  const serialTracked = isSerialTracked(lineItemId)
                  const options = serialOptions[field.id] ?? []
                  const loading = serialLoading[field.id] ?? false

                  return (
                    <div key={field.id} className="rounded-lg border border-zinc-100 p-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <Controller
                            name={`lines.${index}.itemId`}
                            control={control}
                            render={({ field: f }) => (
                              <select
                                {...f}
                                onChange={(e) => {
                                  f.onChange(e)
                                  handleItemChange(index, field.id, e.target.value)
                                }}
                                className={`${fieldClass} bg-white`}
                              >
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
                          {serialTracked ? (
                            <div
                              className={`${fieldClass} flex items-center justify-center bg-zinc-50 text-zinc-500`}
                            >
                              Qty: 1
                            </div>
                          ) : (
                            <Controller
                              name={`lines.${index}.quantity`}
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
                          )}
                          {errors.lines?.[index]?.quantity && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors.lines[index].quantity?.message}
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

                      {serialTracked && (
                        <div className="mt-2">
                          <label className="mb-1 block text-xs font-medium text-zinc-600">
                            Serial Number <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name={`lines.${index}.serialNumberId`}
                            control={control}
                            render={({ field: sf }) => (
                              <select
                                {...sf}
                                disabled={loading || !fromId}
                                className={`${fieldClass} bg-white`}
                              >
                                <option value="">
                                  {!fromId
                                    ? 'Select source warehouse first…'
                                    : loading
                                      ? 'Loading serials…'
                                      : options.length === 0
                                        ? 'No available serials at source'
                                        : 'Select serial…'}
                                </option>
                                {options.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.serialNumber}
                                  </option>
                                ))}
                              </select>
                            )}
                          />
                          {errors.lines?.[index]?.serialNumberId && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors.lines[index].serialNumberId?.message}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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
              {isSubmitting ? 'Saving…' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
