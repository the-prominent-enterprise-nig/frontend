'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2, Package } from 'lucide-react'
import { CreateBundleFormSchema, CreateBundleFormValues } from '@/src/schema/inventory/bundles'
import type { ItemSummary, CategoryOption, UomOption } from '@/src/schema/inventory/items'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateBundleFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  itemOptions: ItemSummary[]
  categoryOptions: CategoryOption[]
  uomOptions: UomOption[]
}

export default function CreateBundleModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  itemOptions,
  categoryOptions,
  uomOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBundleFormValues>({
    resolver: zodResolver(CreateBundleFormSchema),
    defaultValues: {
      costPrice: 0,
      isSerialTracked: false,
      components: [{ componentItemId: '', quantityPerBundle: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'components' })

  useEffect(() => {
    if (!isOpen) {
      reset({
        costPrice: 0,
        isSerialTracked: false,
        components: [{ componentItemId: '', quantityPerBundle: 1 }],
      })
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateBundleFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Create Bundle Kit</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Define a sellable kit by combining multiple component SKUs.
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
            {/* Name + SKU */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Bundle Name <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <input {...field} placeholder="e.g. Starter Desk Kit" className={fieldClass} />
                  )}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  SKU <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      placeholder="e.g. BUNDLE-DESK-01"
                      className={`${fieldClass} font-mono`}
                    />
                  )}
                />
                {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku.message}</p>}
              </div>
            </div>

            {/* Category + UOM */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="primaryCategoryId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select category…</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.primaryCategoryId && (
                  <p className="mt-1 text-xs text-red-600">{errors.primaryCategoryId.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Unit of Measure <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="baseUnitId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select unit…</option>
                      {uomOptions.map((uom) => (
                        <option key={uom.id} value={uom.id}>
                          {uom.code} — {uom.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.baseUnitId && (
                  <p className="mt-1 text-xs text-red-600">{errors.baseUnitId.message}</p>
                )}
              </div>
            </div>

            {/* Cost + Selling Price */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Cost Price <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="costPrice"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  )}
                />
                {errors.costPrice && (
                  <p className="mt-1 text-xs text-red-600">{errors.costPrice.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Selling Price
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="sellingPrice"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                      }
                    />
                  )}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Description
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Brief description of what this bundle includes…"
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
            </div>

            {/* Serial tracking */}
            <div className="flex items-start gap-2 rounded-lg border border-zinc-200 px-4 py-3">
              <Controller
                name="isSerialTracked"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="bundle-is-serial-tracked"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                  />
                )}
              />
              <label htmlFor="bundle-is-serial-tracked" className="text-sm text-zinc-700">
                <span className="font-medium">Serial Tracked (e.g. Furniture Set)</span>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Sold and registered as one physical unit with its own serial number, instead of
                  tracking each component individually at checkout.
                </p>
              </label>
            </div>

            {/* Component Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-700">
                  Component Items <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => append({ componentItemId: '', quantityPerBundle: 1 })}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add component
                </button>
              </div>

              {errors.components?.root && (
                <p className="mb-2 text-xs text-red-600">{errors.components.root.message}</p>
              )}
              {typeof errors.components?.message === 'string' && (
                <p className="mb-2 text-xs text-red-600">{errors.components.message}</p>
              )}

              <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Controller
                        name={`components.${index}.componentItemId`}
                        control={control}
                        render={({ field: f }) => (
                          <select {...f} className={`${fieldClass} bg-white`}>
                            <option value="">Select item…</option>
                            {itemOptions.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.sku} — {item.name}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                      {errors.components?.[index]?.componentItemId && (
                        <p className="mt-0.5 text-xs text-red-600">
                          {errors.components[index]?.componentItemId?.message}
                        </p>
                      )}
                    </div>

                    <div className="w-24 shrink-0">
                      <Controller
                        name={`components.${index}.quantityPerBundle`}
                        control={control}
                        render={({ field: f }) => (
                          <input
                            {...f}
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="Qty"
                            title="Quantity per bundle"
                            className={`${fieldClass} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            onChange={(e) =>
                              f.onChange(e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                        )}
                      />
                      {errors.components?.[index]?.quantityPerBundle && (
                        <p className="mt-0.5 text-xs text-red-600">
                          {errors.components[index]?.quantityPerBundle?.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="mt-2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="mt-1.5 text-xs text-zinc-400">
                Bundle availability = minimum of{' '}
                <span className="font-medium">floor(stock ÷ quantity)</span> across all components.
              </p>
            </div>

            {/* Info notice */}
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-xs text-blue-800">
                When a bundle is sold, stock is automatically deducted from each component item
                proportionally. The bundle itself does not hold separate stock.
              </p>
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
              {isSubmitting ? 'Creating…' : 'Create Bundle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
