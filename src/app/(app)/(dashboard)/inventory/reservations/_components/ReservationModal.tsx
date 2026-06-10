'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  ReservationFormSchema,
  type ReservationFormValues,
} from '@/src/schema/inventory/reservations'
import type { ApiResponse } from '@/src/libs/api/client'

type ItemOption = { id: string; name: string; sku: string }
type WarehouseOption = { id: string; name: string; code: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReservationFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  items: ItemOption[]
  warehouses: WarehouseOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function ReservationModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  items,
  warehouses,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(ReservationFormSchema),
    defaultValues: {
      itemId: '',
      warehouseId: '',
      reservedQty: 1,
      referenceType: 'sales_order',
      referenceId: '',
      expiresAt: '',
    },
  })

  useEffect(() => {
    if (!isOpen) {
      reset({
        itemId: '',
        warehouseId: '',
        reservedQty: 1,
        referenceType: 'sales_order',
        referenceId: '',
        expiresAt: '',
      })
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: ReservationFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">New Reservation</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Reserve stock against a sales order or quotation.
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
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Reserved Quantity <span className="text-red-500">*</span>
              </label>
              <Controller
                name="reservedQty"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                )}
              />
              {errors.reservedQty && (
                <p className="mt-1 text-xs text-red-600">{errors.reservedQty.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reference Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="referenceType"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="sales_order">Sales Order</option>
                      <option value="quotation">Quotation</option>
                    </select>
                  )}
                />
                {errors.referenceType && (
                  <p className="mt-1 text-xs text-red-600">{errors.referenceType.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reference ID <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="referenceId"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. SO-0001"
                      className={fieldClass}
                    />
                  )}
                />
                {errors.referenceId && (
                  <p className="mt-1 text-xs text-red-600">{errors.referenceId.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Expires At <span className="text-red-500">*</span>
              </label>
              <Controller
                name="expiresAt"
                control={control}
                render={({ field }) => (
                  <input {...field} type="datetime-local" className={fieldClass} />
                )}
              />
              {errors.expiresAt && (
                <p className="mt-1 text-xs text-red-600">{errors.expiresAt.message}</p>
              )}
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
              {isSubmitting ? 'Saving…' : 'Create Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
