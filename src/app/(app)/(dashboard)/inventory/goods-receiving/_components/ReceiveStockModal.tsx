'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  ReceiveStockFormSchema,
  type ReceiveStockFormValues,
} from '@/src/schema/inventory/goods-receiving'
import type { ApiResponse } from '@/src/libs/api/client'
import type { ItemSummary } from '@/src/schema/inventory/items'

type WarehouseOption = { id: string; name: string; code: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReceiveStockFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseOption[]
  items: ItemSummary[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
const cellInputClass =
  'w-full rounded border border-zinc-200 px-2 py-1 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const emptyLine = (): ReceiveStockFormValues['lines'][number] => ({
  itemId: '',
  quantityReceived: 0,
  unitCost: undefined,
  batchNumber: '',
  expiryDate: '',
  qualityHold: false,
  autoGenerateSerials: false,
  notes: '',
})

const defaultValues: ReceiveStockFormValues = {
  code: '',
  purchaseOrderNumber: '',
  purchaseOrderDate: '',
  warehouseId: '',
  applicationType: 'new_stock',
  modeOfTransfer: '',
  nndpCost: undefined,
  receivedAt: '',
  notes: '',
  lines: [],
}

export default function ReceiveStockModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  items,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReceiveStockFormValues>({
    resolver: zodResolver(ReceiveStockFormSchema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  useEffect(() => {
    if (!isOpen) reset(defaultValues)
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: ReceiveStockFormValues): Promise<void> {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  const watchedLines = watch('lines')

  function handleItemChange(idx: number, itemId: string): void {
    setValue(`lines.${idx}.itemId`, itemId)
    const item = items.find((i) => i.id === itemId)
    if (item?.costPrice != null) setValue(`lines.${idx}.unitCost`, item.costPrice)
    if (!item?.isSerialTracked) setValue(`lines.${idx}.autoGenerateSerials`, false)
  }

  function isLineSerialTracked(idx: number): boolean {
    const itemId = watchedLines?.[idx]?.itemId
    return !!items.find((i) => i.id === itemId)?.isSerialTracked
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Receive Stock</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Record incoming stock into inventory.</p>
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
            {/* Reference Number + Date Received */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reference Number
                </label>
                <Controller
                  name="code"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Auto-generated if blank"
                      className={fieldClass}
                    />
                  )}
                />
                <p className="mt-0.5 text-xs text-zinc-400">
                  Leave blank to auto-generate (GRN-YYYYMMDD-NNNN)
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Date Received
                </label>
                <Controller
                  name="receivedAt"
                  control={control}
                  render={({ field }) => (
                    <input {...field} type="datetime-local" className={fieldClass} />
                  )}
                />
              </div>
            </div>

            {/* PO Number + PO Date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">PO Number</label>
                <Controller
                  name="purchaseOrderNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. PO-2025-001"
                      className={fieldClass}
                    />
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Purchase Order Date
                </label>
                <Controller
                  name="purchaseOrderDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
            </div>

            {/* Destination Warehouse */}
            <div className="sm:w-1/2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Destination Warehouse <span className="text-red-500">*</span>
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

            {/* Application Type + Mode of Transfer */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Application Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="applicationType"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="new_stock">New Stock</option>
                      <option value="revert">Revert</option>
                    </select>
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Mode of Transfer
                </label>
                <Controller
                  name="modeOfTransfer"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. Road, Air, Sea"
                      className={fieldClass}
                    />
                  )}
                />
              </div>
            </div>

            {/* NNDP Cost */}
            <div className="sm:w-1/2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">NNDP Cost</label>
              <Controller
                name="nndpCost"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={field.value ?? ''}
                    className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                )}
              />
              {errors.nndpCost && (
                <p className="mt-1 text-xs text-red-600">{errors.nndpCost.message}</p>
              )}
            </div>

            {/* Items to Receive */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-800">Items to Receive</h3>
                <button
                  type="button"
                  onClick={() => append(emptyLine())}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-8 text-center text-sm text-zinc-400">
                  No items added yet. Click &ldquo;Add Item&rdquo; to begin.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Unit Cost</th>
                        <th className="px-3 py-2">Batch No.</th>
                        <th className="px-3 py-2 text-center">QC Hold</th>
                        <th className="px-3 py-2 text-center">Auto Serial</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {fields.map((field, idx) => (
                        <tr key={field.id} className="hover:bg-zinc-50">
                          <td className="px-3 py-2 min-w-45">
                            <Controller
                              name={`lines.${idx}.itemId`}
                              control={control}
                              render={({ field: f }) => (
                                <select
                                  value={f.value}
                                  onChange={(e) => handleItemChange(idx, e.target.value)}
                                  className={`${cellInputClass} bg-white`}
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
                            {errors.lines?.[idx]?.itemId && (
                              <p className="mt-0.5 text-xs text-red-600">
                                {errors.lines[idx]?.itemId?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Controller
                              name={`lines.${idx}.quantityReceived`}
                              control={control}
                              render={({ field: f }) => (
                                <input
                                  {...f}
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={f.value === 0 ? '' : f.value}
                                  placeholder="0"
                                  className={`w-24 ${cellInputClass}`}
                                  onChange={(e) =>
                                    f.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                                  }
                                />
                              )}
                            />
                            {errors.lines?.[idx]?.quantityReceived && (
                              <p className="mt-0.5 text-xs text-red-600">
                                {errors.lines[idx]?.quantityReceived?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Controller
                              name={`lines.${idx}.unitCost`}
                              control={control}
                              render={({ field: f }) => (
                                <input
                                  {...f}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={f.value ?? ''}
                                  className={`w-28 ${cellInputClass}`}
                                  onChange={(e) =>
                                    f.onChange(
                                      e.target.value === '' ? undefined : Number(e.target.value)
                                    )
                                  }
                                />
                              )}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Controller
                              name={`lines.${idx}.batchNumber`}
                              control={control}
                              render={({ field: f }) => (
                                <input
                                  {...f}
                                  type="text"
                                  placeholder="Optional"
                                  className="w-28 rounded border border-zinc-200 px-2 py-1 text-sm"
                                />
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Controller
                              name={`lines.${idx}.qualityHold`}
                              control={control}
                              render={({ field: f }) => (
                                <input
                                  type="checkbox"
                                  checked={f.value ?? false}
                                  onChange={(e) => f.onChange(e.target.checked)}
                                  className="h-4 w-4 rounded border-zinc-300"
                                />
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isLineSerialTracked(idx) ? (
                              <Controller
                                name={`lines.${idx}.autoGenerateSerials`}
                                control={control}
                                render={({ field: f }) => (
                                  <input
                                    type="checkbox"
                                    checked={f.value ?? false}
                                    onChange={(e) => f.onChange(e.target.checked)}
                                    title="Auto-assign a serial number & barcode per unit received"
                                    className="h-4 w-4 rounded border-zinc-300 accent-prominent-purple-700"
                                  />
                                )}
                              />
                            ) : (
                              <span className="text-xs text-zinc-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => remove(idx)}
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {errors.lines && !Array.isArray(errors.lines) && (
                <p className="mt-1 text-xs text-red-600">{errors.lines.message}</p>
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
                    rows={2}
                    placeholder="Optional notes about this receipt…"
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
              disabled={isSubmitting || fields.length === 0}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Receiving…' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
