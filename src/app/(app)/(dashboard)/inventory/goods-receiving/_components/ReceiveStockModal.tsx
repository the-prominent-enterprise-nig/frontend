'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  ReceiveStockFormSchema,
  type ReceiveStockFormValues,
} from '@/src/schema/inventory/goods-receiving'
import type { ApiResponse } from '@/src/libs/api/client'

type WarehouseOption = { id: string; name: string; code: string }
type ItemOption = { id: string; name: string; sku: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReceiveStockFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseOption[]
  items: ItemOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

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
    watch,
    formState: { errors },
  } = useForm<ReceiveStockFormValues>({
    resolver: zodResolver(ReceiveStockFormSchema),
    defaultValues: { quantity: 1, unitCost: 0, referenceType: 'purchase_order' },
  })

  const batchId = watch('batchId')
  const isBatched = !!batchId && batchId.trim().length > 0

  useEffect(() => {
    if (!isOpen) reset({ quantity: 1, unitCost: 0, referenceType: 'purchase_order' })
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: ReceiveStockFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Receive Stock</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Record incoming stock into a warehouse location.
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

            <div className="grid gap-4 sm:grid-cols-2">
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="0"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  )}
                />
                {errors.quantity && (
                  <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Unit Cost</label>
                <Controller
                  name="unitCost"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={field.value === 0 ? '' : field.value}
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                      }
                    />
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reference Type
                </label>
                <Controller
                  name="referenceType"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="purchase_order">Purchase Order</option>
                      <option value="transfer">Transfer</option>
                      <option value="return">Return</option>
                      <option value="manual">Manual</option>
                    </select>
                  )}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reference ID</label>
              <Controller
                name="referenceId"
                control={control}
                render={({ field }) => (
                  <input {...field} type="text" placeholder="PO-2026-001" className={fieldClass} />
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Batch ID</label>
              <Controller
                name="batchId"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="Batch ID (if applicable)"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            {isBatched && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Expiry Date <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="expiryDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {errors.expiryDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.expiryDate.message}</p>
                )}
              </div>
            )}

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
              disabled={isSubmitting}
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
