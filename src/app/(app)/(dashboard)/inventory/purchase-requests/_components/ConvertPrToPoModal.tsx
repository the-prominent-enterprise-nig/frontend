'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, ShoppingCart, Plus } from 'lucide-react'
import {
  ConvertPrToPoFormSchema,
  type ConvertPrToPoFormValues,
} from '@/src/schema/inventory/purchase-orders'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import { NumericInput } from '@/src/app/(app)/(dashboard)/inventory/items/_components/item-form-shared'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'

type Props = {
  open: boolean
  onClose: () => void
  pr: PurchaseRequestSummary | null
  onConvert: (prId: string, data: ConvertPrToPoFormValues) => Promise<void>
  isConverting?: boolean
}

export function ConvertPrToPoModal({ open, onClose, pr, onConvert, isConverting }: Props) {
  // Scenario 27 — a PO's destination is always one of the 2 real warehouses,
  // decided once here at creation and carried through unedited to receiving
  // (see ReceiveAgainstPoModal, which locks the field once this is set).
  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup', 'standalone'],
    queryFn: () => getWarehouses({ limit: 10, status: 'active', standaloneOnly: true }),
    enabled: !!pr,
    staleTime: 5 * 60 * 1000,
  })

  const warehouses = warehousesQuery.data?.data?.data ?? []

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ConvertPrToPoFormValues>({
    resolver: zodResolver(ConvertPrToPoFormSchema),
    defaultValues: {
      supplierId: '',
      warehouseId: '',
      expectedDeliveryDate: '',
      deliveryInstructions: '',
      paymentTerms: '',
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
      // A manually-created PR now already carries the same commitment a PO
      // would (supplier, warehouse, firm pricing) — pre-fill from it rather
      // than starting blank, so approving+converting needs little to no
      // re-entry. Auto-raised PRs (from a ServiceDraft shortfall) still
      // lack all of this, so they fall back to blank exactly as before.
      reset({
        supplierId: pr.supplierId ?? '',
        warehouseId: pr.warehouseId ?? '',
        expectedDeliveryDate: pr.expectedDeliveryDate ? pr.expectedDeliveryDate.slice(0, 10) : '',
        deliveryInstructions: pr.deliveryInstructions ?? '',
        paymentTerms: pr.paymentTerms ?? '',
        notes: pr.notes ?? '',
        lines: pr.lines.map((line) => ({
          prLineId: line.id,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice ?? 0),
          description: line.description ?? '',
          notes: line.notes ?? '',
          // Scenario 29 PO-14 — carry the discount breakdown over too, not
          // just the already-computed unit price.
          srp: line.srp != null ? Number(line.srp) : undefined,
          discounts:
            line.discounts && line.discounts.length > 0
              ? line.discounts
              : [{ type: 'percentage', value: 0 }],
          isFreebie: line.isFreebie ?? false,
        })),
      })
    } else if (!open) {
      reset({
        supplierId: '',
        warehouseId: '',
        expectedDeliveryDate: '',
        deliveryInstructions: '',
        paymentTerms: '',
        notes: '',
        lines: [],
      })
    }
  }, [open, pr, reset])

  // Unit Price defaults to srp with every discount step applied
  // sequentially — same logic as PurchaseOrderFormFields.tsx's
  // recomputeUnitPrice, only fires off srp/discount changes so a manual
  // override isn't immediately overwritten.
  function recomputeUnitPrice(index: number) {
    const line = getValues(`lines.${index}`)
    const srp = Number(line?.srp)
    if (!line?.srp || !line.discounts || line.discounts.length === 0) return
    const computed = line.discounts.reduce((price, d) => {
      const val = Number(d?.value)
      if (!d?.type || d.value == null || isNaN(val)) return price
      return d.type === 'percentage' ? price * (1 - val / 100) : price - val
    }, srp)
    setValue(`lines.${index}.unitPrice`, Math.max(0, Number(computed.toFixed(2))))
  }

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
                    initialLabel={pr?.supplier?.name}
                  />
                )}
              />
              {errors.supplierId && (
                <p className="mt-1 text-xs text-red-500">{errors.supplierId.message}</p>
              )}
            </div>

            {/* Location + Expected Delivery */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Location <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      value={field.value ?? ''}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    >
                      <option value="">Select location…</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.branch?.name ?? wh.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.warehouseId && (
                  <p className="mt-1 text-xs text-red-500">{errors.warehouseId.message}</p>
                )}
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
                {fields.map((field, index) => (
                  <ConvertPrToPoLineCard
                    key={field.id}
                    control={control}
                    errors={errors}
                    index={index}
                    prLine={pr.lines[index]}
                    recomputeUnitPrice={recomputeUnitPrice}
                  />
                ))}
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

type LineCardProps = {
  control: Control<ConvertPrToPoFormValues>
  errors: FieldErrors<ConvertPrToPoFormValues>
  index: number
  prLine: PurchaseRequestSummary['lines'][number] | undefined
  recomputeUnitPrice: (index: number) => void
}

// Its own component (not inlined in the parent's .map()) so the discount
// chain's own useFieldArray can be called per line — same reason
// PurchaseOrderFormFields.tsx splits PurchaseOrderLineCard out.
function ConvertPrToPoLineCard({
  control,
  errors,
  index,
  prLine,
  recomputeUnitPrice,
}: LineCardProps) {
  const {
    fields: discountFields,
    append: appendDiscount,
    remove: removeDiscount,
  } = useFieldArray({
    control,
    name: `lines.${index}.discounts` as `lines.${number}.discounts`,
  })

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      {/* Item info + Freebie */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            {prLine?.item.name ?? `Line ${index + 1}`}
          </p>
          {prLine && (
            <p className="text-xs text-zinc-500">
              SKU: {prLine.item.sku} &middot; Requested qty: {prLine.quantity}
              {prLine.unitPrice
                ? ` · PR price: ₱${Number(prLine.unitPrice).toLocaleString()}`
                : null}
            </p>
          )}
        </div>
        <Controller
          name={`lines.${index}.isFreebie`}
          control={control}
          render={({ field: f }) => (
            <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={Boolean(f.value)}
                onChange={(e) => f.onChange(e.target.checked)}
              />
              Freebie
            </label>
          )}
        />
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
            <p className="mt-1 text-xs text-red-500">{errors.lines[index]?.quantity?.message}</p>
          )}
        </div>

        {/* Supplier SRP */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Supplier SRP</label>
          <Controller
            name={`lines.${index}.srp`}
            control={control}
            render={({ field: f }) => (
              <NumericInput
                value={f.value}
                onChange={(v) => {
                  f.onChange(v ?? undefined)
                  recomputeUnitPrice(index)
                }}
                onBlur={f.onBlur}
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
            )}
          />
        </div>
      </div>

      {/* Discount chain (Scenario 29 PO-14 — carried over from the PR line) */}
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-zinc-600">Discounts (off SRP)</label>
        {discountFields.map((discountField, discountIndex) => (
          <div key={discountField.id} className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-3 gap-2">
              <Controller
                name={`lines.${index}.discounts.${discountIndex}.name`}
                control={control}
                render={({ field: f }) => (
                  <input
                    {...f}
                    value={f.value ?? ''}
                    type="text"
                    placeholder="Discount name"
                    maxLength={100}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              <Controller
                name={`lines.${index}.discounts.${discountIndex}.type`}
                control={control}
                render={({ field: f }) => (
                  <select
                    {...f}
                    onChange={(e) => {
                      f.onChange(e)
                      recomputeUnitPrice(index)
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="amount">Flat amount</option>
                  </select>
                )}
              />
              <Controller
                name={`lines.${index}.discounts.${discountIndex}.value`}
                control={control}
                render={({ field: f }) => (
                  <NumericInput
                    value={f.value}
                    onChange={(v) => {
                      f.onChange(v ?? 0)
                      recomputeUnitPrice(index)
                    }}
                    onBlur={f.onBlur}
                    placeholder="Percent or amount"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                removeDiscount(discountIndex)
                recomputeUnitPrice(index)
              }}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
              aria-label="Remove discount"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendDiscount({ name: undefined, type: 'percentage', value: 0 })}
          className="flex items-center gap-1 text-xs font-medium text-prominent-purple-700 hover:underline"
        >
          <Plus className="h-3 w-3" />
          Add another discount
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
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
            <p className="mt-1 text-xs text-red-500">{errors.lines[index]?.unitPrice?.message}</p>
          )}
        </div>

        {/* Description (pricing breakdown) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Description
            <span className="ml-1 font-normal text-zinc-400">(pricing breakdown)</span>
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
          <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
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
}
