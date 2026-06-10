'use client'

import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  X,
  Plus,
  Trash2,
  Tag,
  Package,
  Info,
  Pencil,
  ImageIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import ItemImageGallery from './ItemImageGallery'
import { CreateVariantFormSchema } from '@/src/schema/inventory/variants'
import type { CreateVariantFormValues, VariantSummary } from '@/src/schema/inventory/variants'
import type { ItemSummary } from '@/src/schema/inventory/items'

type Props = {
  isOpen: boolean
  item: ItemSummary | null
  variants: VariantSummary[]
  isLoading: boolean
  onClose: () => void
  onCreateVariant: (itemId: string, data: CreateVariantFormValues) => Promise<unknown>
  isCreating: boolean
  onEditItem?: (item: ItemSummary) => void
}

function VariantCard({ variant, itemId }: { variant: VariantSummary; itemId: string }) {
  const [imagesOpen, setImagesOpen] = useState(false)

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-mono text-sm font-medium text-zinc-800">
              {variant.variantSku}
            </span>
            {variant.priceOverride != null && (
              <span className="rounded-full bg-prominent-purple-100 px-2 py-0.5 text-xs font-medium text-prominent-purple-700">
                ₱
                {Number(variant.priceOverride).toLocaleString('en-PH', {
                  minimumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
          {variant.attributes && Object.keys(variant.attributes).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(variant.attributes).map(([k, val]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                >
                  <span className="font-medium text-zinc-500">{k}:</span>
                  {val}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right text-xs text-zinc-500">
            {variant.availableQty != null ? (
              <span>
                <span className="font-medium text-zinc-700">{variant.availableQty}</span> avail
              </span>
            ) : variant.onHandQty != null ? (
              <span>
                <span className="font-medium text-zinc-700">{variant.onHandQty}</span> on hand
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setImagesOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 hover:border-prominent-purple-300 hover:text-prominent-purple-700"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Images
            {imagesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {imagesOpen && (
        <div className="border-t border-zinc-200 px-4 pb-4 pt-3">
          <ItemImageGallery itemId={itemId} variantId={variant.id} />
        </div>
      )}
    </div>
  )
}

export default function VariantsModal({
  isOpen,
  item,
  variants,
  isLoading,
  onClose,
  onCreateVariant,
  isCreating,
  onEditItem,
}: Props) {
  const variantsEnabled = item?.hasVariants === true
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateVariantFormValues>({
    resolver: zodResolver(CreateVariantFormSchema),
    defaultValues: {
      variantSku: '',
      attributes: [{ key: '', value: '' }],
      priceOverride: undefined,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'attributes' })

  useEffect(() => {
    if (!isOpen) {
      reset({ variantSku: '', attributes: [{ key: '', value: '' }], priceOverride: undefined })
    }
  }, [isOpen, reset])

  if (!isOpen || !item) return null

  async function onSubmit(data: CreateVariantFormValues) {
    await onCreateVariant(item!.id, data)
    reset({ variantSku: '', attributes: [{ key: '', value: '' }], priceOverride: undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Item Variants</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {item.name} <span className="font-mono text-xs text-zinc-400">({item.sku})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {/* Variants not enabled banner */}
          {!variantsEnabled && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">
                  Variants not enabled for this item
                </p>
                <p className="mt-0.5 text-xs text-blue-600">
                  Open <span className="font-semibold">Edit Item</span> and turn on{' '}
                  <span className="font-semibold">Has Variants</span>, then come back here to add
                  variants.
                </p>
              </div>
              {onEditItem && item && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onEditItem(item)
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Item
                </button>
              )}
            </div>
          )}

          {/* Existing Variants */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-zinc-700">
              Existing Variants ({variants.length})
            </h3>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100" />
                ))}
              </div>
            ) : variants.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-8">
                <Package className="mb-2 h-8 w-8 text-zinc-300" />
                <p className="text-sm text-zinc-400">No variants yet. Add one below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {variants.map((v) => (
                  <VariantCard key={v.id} variant={v} itemId={item!.id} />
                ))}
              </div>
            )}
          </section>

          {/* Add Variant Form */}
          {variantsEnabled && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-zinc-700">Add Variant</h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* SKU + Price row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Variant SKU <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('variantSku')}
                      placeholder="e.g. SHIRT-RED-L"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                    {errors.variantSku && (
                      <p className="mt-1 text-xs text-red-500">{errors.variantSku.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Price Override
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('priceOverride', {
                        setValueAs: (v) => (v === '' ? undefined : Number(v)),
                      })}
                      placeholder="Leave blank to use item price"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                    {errors.priceOverride && (
                      <p className="mt-1 text-xs text-red-500">{errors.priceOverride.message}</p>
                    )}
                  </div>
                </div>

                {/* Attributes */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-600">
                      Attributes <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => append({ key: '', value: '' })}
                      className="flex items-center gap-1 text-xs font-medium text-prominent-purple-600 hover:text-prominent-purple-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Attribute
                    </button>
                  </div>
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-2">
                        <div className="flex-1">
                          <input
                            {...register(`attributes.${index}.key`)}
                            placeholder="e.g. Color"
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                          />
                          {errors.attributes?.[index]?.key && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.attributes[index]?.key?.message}
                            </p>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            {...register(`attributes.${index}.value`)}
                            placeholder="e.g. Red"
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                          />
                          {errors.attributes?.[index]?.value && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.attributes[index]?.value?.message}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length <= 1}
                          className="mt-1.5 rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {errors.attributes?.root && (
                    <p className="mt-1 text-xs text-red-500">{errors.attributes.root.message}</p>
                  )}
                  {typeof errors.attributes?.message === 'string' && (
                    <p className="mt-1 text-xs text-red-500">{errors.attributes.message}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                  >
                    {isCreating ? 'Creating…' : 'Add Variant'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
