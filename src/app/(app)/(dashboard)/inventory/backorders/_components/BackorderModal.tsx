'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import { BackorderFormSchema, type BackorderFormValues } from '@/src/schema/inventory/backorders'
import type { ApiResponse } from '@/src/libs/api/client'

type ItemOption = { id: string; name: string; sku: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: BackorderFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  items: ItemOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function BackorderModal({ isOpen, onClose, onSubmit, isSubmitting, items }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BackorderFormValues>({
    resolver: zodResolver(BackorderFormSchema),
    defaultValues: {
      salesOrderId: '',
      salesOrderLineId: '',
      itemId: '',
      orderedQty: 1,
      backorderedQty: 1,
      commitmentDate: '',
      expectedFulfillAt: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (!isOpen) {
      reset({
        salesOrderId: '',
        salesOrderLineId: '',
        itemId: '',
        orderedQty: 1,
        backorderedQty: 1,
        commitmentDate: '',
        expectedFulfillAt: '',
        notes: '',
      })
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: BackorderFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">New Backorder</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Record an item that cannot be fulfilled immediately.
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Sales Order ID <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="salesOrderId"
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
                {errors.salesOrderId && (
                  <p className="mt-1 text-xs text-red-600">{errors.salesOrderId.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Sales Order Line ID <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="salesOrderLineId"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. SOL-001"
                      className={fieldClass}
                    />
                  )}
                />
                {errors.salesOrderLineId && (
                  <p className="mt-1 text-xs text-red-600">{errors.salesOrderLineId.message}</p>
                )}
              </div>
            </div>

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
                  Ordered Qty <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="orderedQty"
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
                {errors.orderedQty && (
                  <p className="mt-1 text-xs text-red-600">{errors.orderedQty.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Backordered Qty <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="backorderedQty"
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
                {errors.backorderedQty && (
                  <p className="mt-1 text-xs text-red-600">{errors.backorderedQty.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Commitment Date <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="commitmentDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {errors.commitmentDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.commitmentDate.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Expected Fulfil At{' '}
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="expectedFulfillAt"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
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
              {isSubmitting ? 'Saving…' : 'Create Backorder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
