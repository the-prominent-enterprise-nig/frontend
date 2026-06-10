'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, ShieldAlert } from 'lucide-react'
import { PlaceOnHoldFormSchema, PlaceOnHoldFormValues } from '@/src/schema/inventory/quality-hold'
import type { ApiResponse } from '@/src/libs/api/client'
import type { ItemSummary } from '@/src/schema/inventory/items'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PlaceOnHoldFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  itemOptions: ItemSummary[]
}

export default function PlaceOnHoldModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  itemOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlaceOnHoldFormValues>({
    resolver: zodResolver(PlaceOnHoldFormSchema),
    defaultValues: {
      itemId: '',
      batchNumber: '',
      receivedViaGrId: '',
      manufactureDate: '',
      expiryDate: '',
      reason: '',
    },
  })

  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: PlaceOnHoldFormValues) {
    const result = await onSubmit({
      ...data,
      receivedViaGrId: data.receivedViaGrId || undefined,
      manufactureDate: data.manufactureDate || undefined,
      expiryDate: data.expiryDate || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-zinc-900">Place on Quality Hold</h2>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              Held stock will not be available for sale or transfer pending inspection.
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
          <div className="grid gap-4 px-6 py-5">
            {/* Item */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Item <span className="text-red-500">*</span>
              </label>
              <Controller
                name="itemId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">Select item…</option>
                    {itemOptions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sku})
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.itemId && (
                <p className="mt-1 text-xs text-red-600">{errors.itemId.message}</p>
              )}
            </div>

            {/* Batch Number */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Batch / Lot Number <span className="text-red-500">*</span>
              </label>
              <Controller
                name="batchNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. BATCH-2024-001"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.batchNumber && (
                <p className="mt-1 text-xs text-red-600">{errors.batchNumber.message}</p>
              )}
            </div>

            {/* GR / PO Reference */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                GR / PO Reference
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  (optional — links to original receipt)
                </span>
              </label>
              <Controller
                name="receivedViaGrId"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. GR-2024-0089 or PO-2024-0042"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Manufacture Date
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="manufactureDate"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="date"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Expiry Date
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="expiryDate"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="date"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Reason for Hold <span className="text-red-500">*</span>
              </label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    placeholder="Describe why this batch is being held for inspection…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
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
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Placing hold…' : 'Place on Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
