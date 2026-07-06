'use client'

import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, PackageCheck, AlertTriangle, Wrench } from 'lucide-react'
import { CreateReturnFormSchema, CreateReturnFormValues } from '@/src/schema/inventory/returns'
import type { ApiResponse } from '@/src/libs/api/client'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateReturnFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  itemOptions: ItemSummary[]
  warehouseOptions: WarehouseSummary[]
  serialOptions: SerialNumberSummary[]
}

export default function CreateReturnModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  itemOptions,
  warehouseOptions,
  serialOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateReturnFormValues>({
    resolver: zodResolver(CreateReturnFormSchema),
    defaultValues: {
      itemId: '',
      warehouseId: '',
      quantity: undefined,
      condition: 'sellable',
      originalSaleId: '',
      notes: '',
      serialNumberId: '',
      repairDecision: undefined,
    },
  })

  const condition = watch('condition')
  const repairDecision = watch('repairDecision')
  const selectedItemId = watch('itemId')

  const itemSerials = useMemo(
    () => serialOptions.filter((s) => s.item?.id === selectedItemId),
    [serialOptions, selectedItemId]
  )

  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  useEffect(() => {
    if (repairDecision === 'flag_for_repair' && itemSerials.length === 1) {
      setValue('serialNumberId', itemSerials[0].id)
    }
  }, [repairDecision, itemSerials, setValue])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateReturnFormValues) {
    const result = await onSubmit({
      ...data,
      originalSaleId: data.originalSaleId || undefined,
      notes: data.notes || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Process Return</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Restock returned items and update stock balance immediately.
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

            {/* Warehouse */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Return to Warehouse <span className="text-red-500">*</span>
              </label>
              <Controller
                name="warehouseId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">Select warehouse…</option>
                    {warehouseOptions.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.warehouseId && (
                <p className="mt-1 text-xs text-red-600">{errors.warehouseId.message}</p>
              )}
            </div>

            {/* Quantity */}
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
                    min="1"
                    step="1"
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                )}
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
              )}
            </div>

            {/* Condition */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Condition upon inspection <span className="text-red-500">*</span>
              </label>
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange('sellable')}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        field.value === 'sellable'
                          ? 'border-green-500 bg-green-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <PackageCheck
                        className={`h-5 w-5 ${
                          field.value === 'sellable' ? 'text-green-600' : 'text-zinc-400'
                        }`}
                      />
                      <div className="text-center">
                        <p
                          className={`text-sm font-semibold ${
                            field.value === 'sellable' ? 'text-green-700' : 'text-zinc-700'
                          }`}
                        >
                          Sellable
                        </p>
                        <p className="text-xs text-zinc-500">Returns to available stock</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange('damaged')}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        field.value === 'damaged'
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-5 w-5 ${
                          field.value === 'damaged' ? 'text-orange-600' : 'text-zinc-400'
                        }`}
                      />
                      <div className="text-center">
                        <p
                          className={`text-sm font-semibold ${
                            field.value === 'damaged' ? 'text-orange-700' : 'text-zinc-700'
                          }`}
                        >
                          Damaged
                        </p>
                        <p className="text-xs text-zinc-500">On-hand only, not sellable</p>
                      </div>
                    </button>
                  </div>
                )}
              />
              {errors.condition && (
                <p className="mt-1 text-xs text-red-600">{errors.condition.message}</p>
              )}
            </div>

            {/* Damaged info banner */}
            {condition === 'damaged' && (
              <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <p className="text-xs text-orange-700">
                  Damaged items are added to on-hand quantity only and will <strong>not</strong> be
                  available for sale. Consider creating a write-off to expense the loss.
                </p>
              </div>
            )}

            {/* Repair Decision (for damaged/serial-tracked units) */}
            {condition === 'damaged' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  What should happen to this unit?
                </label>
                <Controller
                  name="repairDecision"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => field.onChange('restock')}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                          field.value === 'restock' || field.value === undefined
                            ? 'border-zinc-400 bg-zinc-50'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <PackageCheck className="h-5 w-5 text-zinc-500" />
                        <div className="text-center">
                          <p className="text-sm font-semibold text-zinc-700">Restock</p>
                          <p className="text-xs text-zinc-500">Keep as on-hand (damaged)</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange('flag_for_repair')}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                          field.value === 'flag_for_repair'
                            ? 'border-red-500 bg-red-50'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <Wrench
                          className={`h-5 w-5 ${field.value === 'flag_for_repair' ? 'text-red-600' : 'text-zinc-400'}`}
                        />
                        <div className="text-center">
                          <p
                            className={`text-sm font-semibold ${field.value === 'flag_for_repair' ? 'text-red-700' : 'text-zinc-700'}`}
                          >
                            Flag for Repair
                          </p>
                          <p className="text-xs text-zinc-500">Auto-creates a UDS</p>
                        </div>
                      </button>
                    </div>
                  )}
                />
              </div>
            )}

            {/* Serial Number (required when flagging for repair) */}
            {repairDecision === 'flag_for_repair' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Serial Number
                  <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    (required to create UDS)
                  </span>
                </label>
                <Controller
                  name="serialNumberId"
                  control={control}
                  render={({ field }) =>
                    itemSerials.length > 0 ? (
                      <select
                        {...field}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      >
                        <option value="">Select serial number…</option>
                        {itemSerials.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.serialNumber}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...field}
                        type="text"
                        placeholder="Paste the SerialNumber record ID"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      />
                    )
                  }
                />
                <p className="mt-1 text-xs text-zinc-400">
                  {itemSerials.length > 0
                    ? 'Select the unit to send for repair. A UDS will be auto-created.'
                    : 'The unit will be marked as "in repair" and a UDS will be auto-created.'}
                </p>
              </div>
            )}

            {/* Original Sale Reference */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Original Sale / Issue Reference
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="originalSaleId"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. SO-2024-0042"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Notes
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    placeholder="Reason for return, condition details…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
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
              {isSubmitting ? 'Processing…' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
