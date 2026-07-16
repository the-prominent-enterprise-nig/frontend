'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, ShoppingCart } from 'lucide-react'
import {
  ConvertPrToPoFormSchema,
  type ConvertPrToPoFormValues,
} from '@/src/schema/inventory/purchase-orders'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import { NumericInput } from '@/src/app/(app)/(dashboard)/inventory/items/_components/item-form-shared'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'

type Props = {
  open: boolean
  onClose: () => void
  pr: PurchaseRequestSummary | null
  onConvert: (prId: string, data: ConvertPrToPoFormValues) => Promise<void>
  isConverting?: boolean
}

export function ConvertPrToPoModal({ open, onClose, pr, onConvert, isConverting }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConvertPrToPoFormValues>({
    resolver: zodResolver(ConvertPrToPoFormSchema),
    defaultValues: {
      supplierId: '',
      warehouseId: '',
      expectedDeliveryDate: '',
      deliveryInstructions: '',
      paymentTerms: '',
      shippingAddress: '',
      notes: '',
      lines: [],
    },
  })

  const { fields } = useFieldArray({
    control,
    name: 'lines',
  })

  useEffect(() => {
    if (open && pr) {
      reset({
        supplierId: '',
        warehouseId: '',
        expectedDeliveryDate: '',
        deliveryInstructions: '',
        paymentTerms: '',
        shippingAddress: '',
        notes: '',
        lines: pr.lines.map((line) => ({
          prLineId: line.id,
          quantity: Number(line.quantity),
          unitPrice: Number(line.estimatedUnitPrice ?? 0),
          description: '',
          notes: '',
        })),
      })
    } else if (!open) {
      reset({
        supplierId: '',
        warehouseId: '',
        expectedDeliveryDate: '',
        deliveryInstructions: '',
        paymentTerms: '',
        shippingAddress: '',
        notes: '',
        lines: [],
      })
    }
  }, [open, pr, reset])

  async function handleFormSubmit(data: ConvertPrToPoFormValues) {
    if (!pr) return
    await onConvert(pr.id, data)
    onClose()
  }

  if (!open || !pr) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-prominent-purple-600" />
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Convert to Purchase Order</h2>
                <p className="mt-0.5 text-sm text-zinc-500">PR: {pr.code}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isConverting}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="px-6 py-4 space-y-4">
            {/* Supplier */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Supplier <span className="text-red-500">*</span>
              </label>
              <Controller
                name="supplierId"
                control={control}
                render={({ field }) => (
                  <SupplierSearchCombobox
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.supplierId?.message}
                  />
                )}
              />
              {errors.supplierId && (
                <p className="mt-1 text-xs text-red-500">{errors.supplierId.message}</p>
              )}
            </div>

            {/* Warehouse + Expected Delivery */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Warehouse ID</label>
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="text"
                      placeholder="Optional warehouse ID"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Expected Delivery Date
                </label>
                <Controller
                  name="expectedDeliveryDate"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="date"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                />
              </div>
            </div>

            {/* Delivery Instructions */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Delivery Instructions
              </label>
              <Controller
                name="deliveryInstructions"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                    placeholder='e.g. "Please deliver to Brgy. Igang, Pototan Covered Gym on June 19, 2026 @ Afternoon"'
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.deliveryInstructions && (
                <p className="mt-1 text-xs text-red-600">{errors.deliveryInstructions.message}</p>
              )}
            </div>

            {/* Payment Terms */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Payment Terms</label>
              <Controller
                name="paymentTerms"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="text"
                    placeholder="e.g. Net 30"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* Shipping Address */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Shipping Address
              </label>
              <Controller
                name="shippingAddress"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                    placeholder="Optional shipping address…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
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
                    placeholder="Optional notes…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* PO Lines */}
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700">
                Order Lines <span className="text-red-500">*</span>
              </p>

              {errors.lines && !Array.isArray(errors.lines) && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const prLine = pr.lines[index]
                  return (
                    <div
                      key={field.id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                    >
                      {/* Item info */}
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {prLine?.item.name ?? `Line ${index + 1}`}
                          </p>
                          {prLine && (
                            <p className="text-xs text-zinc-500">
                              SKU: {prLine.item.sku} &middot; Requested qty: {prLine.quantity}
                              {prLine.estimatedUnitPrice
                                ? ` · Est. price: ₱${Number(prLine.estimatedUnitPrice).toLocaleString()}`
                                : null}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
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

                        {/* Unit Price */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600">
                            Unit Price <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name={`lines.${index}.unitPrice`}
                            control={control}
                            render={({ field: f }) => (
                              <NumericInput
                                value={f.value}
                                onChange={(v) => f.onChange(v ?? 0)}
                                onBlur={f.onBlur}
                                placeholder="0.00"
                                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${errors.lines?.[index]?.unitPrice ? 'border-red-400' : 'border-zinc-200'}`}
                              />
                            )}
                          />
                          {errors.lines?.[index]?.unitPrice && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.lines[index]?.unitPrice?.message}
                            </p>
                          )}
                        </div>

                        {/* Description (pricing breakdown) */}
                        <div className="col-span-2">
                          <label className="mb-1 block text-xs font-medium text-zinc-600">
                            Description
                            <span className="ml-1 font-normal text-zinc-400">
                              (pricing breakdown)
                            </span>
                          </label>
                          <Controller
                            name={`lines.${index}.description`}
                            control={control}
                            render={({ field: f }) => (
                              <input
                                {...f}
                                value={f.value ?? ''}
                                type="text"
                                placeholder='e.g. "(3,649 - 30% - 20%)"'
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                              />
                            )}
                          />
                        </div>

                        {/* Line Notes */}
                        <div className="col-span-2">
                          <label className="mb-1 block text-xs font-medium text-zinc-600">
                            Notes
                          </label>
                          <Controller
                            name={`lines.${index}.notes`}
                            control={control}
                            render={({ field: f }) => (
                              <input
                                {...f}
                                value={f.value ?? ''}
                                type="text"
                                placeholder="Optional line notes"
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isConverting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConverting}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isConverting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isConverting ? 'Creating PO…' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
