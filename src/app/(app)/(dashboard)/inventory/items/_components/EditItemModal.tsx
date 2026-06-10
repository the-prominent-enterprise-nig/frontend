'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Images } from 'lucide-react'
import ItemImageGallery from './ItemImageGallery'
import {
  UpdateItemFormSchema,
  UpdateItemFormValues,
  UomOption,
  ItemSummary,
} from '@/src/schema/inventory/items'
import type { ApiResponse } from '@/src/libs/api/client'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { TaxRates, type TaxRate } from '@/src/libs/data/AccountingV2Data'
import { getAttributes } from '../../attributes/_actions/get-attributes'
import { getItemAttributes } from '../_actions/get-item-attributes'
import type { AttributeDefinition } from '@/src/schema/inventory/attributes'
import { getItemTags, addItemTag, removeItemTag } from '../_actions/item-tags'
import type { ItemTagLabel } from '@/src/schema/inventory/items'
import {
  ALL_TAGS,
  DIMENSION_FIELDS,
  normalizeTagList,
  NumericInput,
  FormSection,
} from './item-form-shared'

type Props = {
  isOpen: boolean
  item: ItemSummary | null
  onClose: () => void
  onSubmit: (data: UpdateItemFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  categories: CategorySelectOption[]
  uomOptions: UomOption[]
  onAttributeSubmit: (attributes: Record<string, string>) => Promise<ApiResponse<unknown>>
  isAttributeSubmitting: boolean
}

export default function EditItemModal({
  isOpen,
  item,
  onClose,
  onSubmit,
  isSubmitting,
  categories,
  uomOptions,
  onAttributeSubmit,
  isAttributeSubmitting,
}: Props) {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})
  const [selectedTags, setSelectedTags] = useState<ItemTagLabel[]>([])
  const [confirmingClose, setConfirmingClose] = useState(false)

  useEffect(() => {
    TaxRates.list(true).then((res) => {
      if (res.success && res.data) setTaxRates(res.data as TaxRate[])
    })
  }, [])

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isDirty, submitCount },
  } = useForm<UpdateItemFormValues>({
    resolver: zodResolver(UpdateItemFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      description: '',
      primaryCategoryId: '',
      baseUnitId: '',
      costPrice: undefined,
      sellingPrice: undefined,
      costingMethod: 'weighted_average',
      isBatchTracked: false,
      isSerialTracked: false,
      isExpiryTracked: false,
      isBundle: false,
      hasVariants: false,
      taxRateId: undefined,
      lengthCm: undefined,
      widthCm: undefined,
      heightCm: undefined,
      weightKg: undefined,
      warrantyPeriodDays: undefined,
    },
  })

  useEffect(() => {
    if (item && isOpen) {
      reset({
        name: item.name,
        sku: item.sku,
        description: item.description ?? '',
        primaryCategoryId: item.primaryCategory?.id ?? undefined,
        baseUnitId: item.baseUnit?.id ?? undefined,
        costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
        sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : undefined,
        costingMethod: 'weighted_average',
        isBatchTracked: false,
        isSerialTracked: false,
        isExpiryTracked: false,
        isBundle: item.isBundle ?? false,
        hasVariants: item.hasVariants ?? false,
        taxRateId: item.taxRateId ?? undefined,
        lengthCm: item.lengthCm != null ? Number(item.lengthCm) : undefined,
        widthCm: item.widthCm != null ? Number(item.widthCm) : undefined,
        heightCm: item.heightCm != null ? Number(item.heightCm) : undefined,
        weightKg: item.weightKg != null ? Number(item.weightKg) : undefined,
        warrantyPeriodDays:
          item.warrantyPeriodDays != null ? Number(item.warrantyPeriodDays) : undefined,
      })
    } else if (!isOpen) {
      reset()
    }
    // Depend on item.id and isOpen only — not the whole item object — so a
    // parent re-render that produces a new item reference doesn't reset the form
    // while the user is mid-edit.
  }, [item?.id, isOpen, reset])

  const selectedCategoryId = useWatch({ control, name: 'primaryCategoryId' })

  const { data: attrDefsData } = useQuery({
    queryKey: ['inventory-attribute-definitions', selectedCategoryId],
    queryFn: () => getAttributes({ categoryId: selectedCategoryId, limit: 100 }),
    enabled: isOpen && !!selectedCategoryId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: existingAttrs } = useQuery({
    queryKey: ['inventory-item-attributes', item?.id],
    queryFn: () => getItemAttributes(item!.id),
    enabled: isOpen && !!item?.id,
    staleTime: 30 * 1000,
  })

  const attrDefs: AttributeDefinition[] = attrDefsData?.data?.data ?? []

  useEffect(() => {
    if (isOpen && existingAttrs) {
      setAttrValues(existingAttrs)
    }
  }, [isOpen, existingAttrs])

  useEffect(() => {
    if (!isOpen) {
      setAttrValues({})
      setSelectedTags([])
    }
  }, [isOpen])

  const { data: existingTagsData } = useQuery({
    queryKey: ['item-tags', item?.id],
    queryFn: () => getItemTags(item!.id),
    enabled: isOpen && !!item?.id,
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    if (isOpen && existingTagsData) {
      setSelectedTags(normalizeTagList(existingTagsData.data))
    }
  }, [isOpen, existingTagsData])

  useEffect(() => {
    if (submitCount === 0) return
    const firstErrorKey = Object.keys(errors)[0] as keyof UpdateItemFormValues | undefined
    if (!firstErrorKey) return
    const t = setTimeout(() => {
      try {
        setFocus(firstErrorKey)
      } catch {}
    }, 50)
    return () => clearTimeout(t)
  }, [submitCount, errors, setFocus])

  if (!isOpen || !item) return null

  const hasUnsavedChanges = isDirty

  function handleRequestClose() {
    if (hasUnsavedChanges) {
      setConfirmingClose(true)
    } else {
      onClose()
    }
  }

  function handleConfirmDiscard() {
    setConfirmingClose(false)
    onClose()
  }

  async function handleFormSubmit(data: UpdateItemFormValues) {
    const result = await onSubmit(data)
    if (!result.success) {
      if (result.error === 'duplicate_sku') {
        setError('sku', { type: 'manual', message: result.message ?? 'SKU already exists' })
      }
      return
    }
    if (attrDefs.length > 0) {
      await onAttributeSubmit(attrValues)
    }
    if (item) {
      const originalTags = normalizeTagList(existingTagsData?.data)
      const toAdd = selectedTags.filter((t) => !originalTags.includes(t))
      const toRemove = originalTags.filter((t) => !selectedTags.includes(t))
      await Promise.all([
        ...toAdd.map((t) => addItemTag(item.id, t)),
        ...toRemove.map((t) => removeItemTag(item.id, t)),
      ])
    }
    onClose()
  }

  const basicInfoErrors = [
    errors.name,
    errors.sku,
    errors.baseUnitId,
    errors.primaryCategoryId,
  ].filter(Boolean).length

  const pricingErrors = [errors.costPrice, errors.sellingPrice].filter(Boolean).length
  const hasSubmitErrors = submitCount > 0 && Object.keys(errors).length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Edit Item</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Update the fields below — required fields are marked *
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestClose}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {confirmingClose && (
            <div className="flex items-center justify-between border-t border-amber-200 bg-amber-50 px-6 py-3">
              <p className="text-sm text-amber-800">You have unsaved changes. Discard them?</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingClose(false)}
                  className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="text-sm font-medium text-red-600 hover:text-red-800"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          {/* Basic Info */}
          <FormSection
            title="Basic Info"
            defaultOpen={true}
            errorCount={basicInfoErrors}
            forceOpen={hasSubmitErrors && basicInfoErrors > 0}
          >
            {/* Item Name */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Item Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            {/* SKU */}
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
                    type="text"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm uppercase outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                )}
              />
              {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku.message}</p>}
            </div>

            {/* Unit of Measure */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Unit of Measure <span className="text-red-500">*</span>
              </label>
              <Controller
                name="baseUnitId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">Select unit…</option>
                    {uomOptions.map((uom) => (
                      <option key={uom.id} value={uom.id}>
                        {uom.code} – {uom.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.baseUnitId && (
                <p className="mt-1 text-xs text-red-600">{errors.baseUnitId.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Category <span className="text-red-500">*</span>
              </label>
              <Controller
                name="primaryCategoryId"
                control={control}
                render={({ field }) => (
                  <CategorySelect
                    value={field.value}
                    onChange={field.onChange}
                    options={categories}
                  />
                )}
              />
              {errors.primaryCategoryId && (
                <p className="mt-1 text-xs text-red-600">{errors.primaryCategoryId.message}</p>
              )}
            </div>

            {/* empty second column for Category row */}
            <div className="hidden sm:block" />

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* Has Variants */}
            <div className="sm:col-span-2">
              <Controller
                name="hasVariants"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                      <div
                        className={`h-5 w-9 rounded-full transition-colors ${field.value ? 'bg-prominent-purple-600' : 'bg-zinc-200'}`}
                      />
                      <div
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-zinc-700">Has Variants</span>
                      <p className="text-xs text-zinc-400">
                        Enable to manage size, color, or style variants under this item
                      </p>
                    </div>
                  </label>
                )}
              />
            </div>
          </FormSection>

          {/* Pricing */}
          <FormSection
            title="Pricing"
            defaultOpen={true}
            errorCount={pricingErrors}
            forceOpen={hasSubmitErrors && pricingErrors > 0}
          >
            {/* Cost Price */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Cost Price (₱) <span className="text-red-500">*</span>
              </label>
              <Controller
                name="costPrice"
                control={control}
                render={({ field }) => (
                  <NumericInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    fieldRef={field.ref}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.costPrice && (
                <p className="mt-1 text-xs text-red-600">{errors.costPrice.message}</p>
              )}
            </div>

            {/* Selling Price */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Selling Price (₱)
              </label>
              <Controller
                name="sellingPrice"
                control={control}
                render={({ field }) => (
                  <NumericInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    fieldRef={field.ref}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* Tax Rate */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Tax Rate</label>
              <Controller
                name="taxRateId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value != null ? String(field.value) : ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">— None —</option>
                    {taxRates
                      .filter((t) => t.isActive)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({Number(t.ratePercent).toFixed(2)}%)
                        </option>
                      ))}
                  </select>
                )}
              />
            </div>

            {/* empty second column for Tax Rate row */}
            <div className="hidden sm:block" />
          </FormSection>

          {/* Physical & Tags */}
          <FormSection title="Physical & Tags" defaultOpen={true}>
            {/* Physical Dimensions */}
            <div className="sm:col-span-2">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Physical Dimensions
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DIMENSION_FIELDS.map(({ name, label, step }) => (
                  <div key={name}>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
                    <Controller
                      name={name}
                      control={control}
                      render={({ field }) => (
                        <NumericInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          fieldRef={field.ref}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Warranty */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Warranty (days)
              </label>
              <Controller
                name="warrantyPeriodDays"
                control={control}
                render={({ field }) => (
                  <NumericInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    fieldRef={field.ref}
                    integer
                    placeholder="e.g. 365"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* empty second column for Warranty row */}
            <div className="hidden sm:block" />

            {/* Tags */}
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-zinc-700">Tags</p>
              <div className="flex flex-wrap gap-3">
                {ALL_TAGS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(value)}
                      onChange={(e) => {
                        setSelectedTags((prev) =>
                          e.target.checked ? [...prev, value] : prev.filter((t) => t !== value)
                        )
                      }}
                      className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </FormSection>

          {/* Images */}
          <FormSection title="Images" defaultOpen={true}>
            <div className="sm:col-span-2">
              <div className="mb-2 flex items-center gap-2">
                <Images className="h-4 w-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-700">Item Images</span>
              </div>
              <ItemImageGallery itemId={item.id} />
            </div>
          </FormSection>

          {/* Custom Attributes — only rendered when attrDefs are present */}
          {attrDefs.length > 0 && (
            <FormSection title="Custom Attributes" defaultOpen={true}>
              {attrDefs.map((def) => (
                <div key={def.id}>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    {def.displayName}
                    {def.isRequired && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {def.dataType === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={attrValues[def.attributeKey] === 'true'}
                      onChange={(e) =>
                        setAttrValues((prev) => ({
                          ...prev,
                          [def.attributeKey]: String(e.target.checked),
                        }))
                      }
                      className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                    />
                  ) : def.dataType === 'dropdown' && def.options?.length ? (
                    <select
                      value={attrValues[def.attributeKey] ?? ''}
                      onChange={(e) =>
                        setAttrValues((prev) => ({ ...prev, [def.attributeKey]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    >
                      <option value="">Select…</option>
                      {def.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : def.dataType === 'multi_select' && def.options?.length ? (
                    <div className="space-y-1">
                      {def.options.map((opt) => {
                        const selected = (attrValues[def.attributeKey] ?? '')
                          .split(',')
                          .filter(Boolean)
                        const checked = selected.includes(opt)
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2 text-sm text-zinc-700"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selected, opt]
                                  : selected.filter((v) => v !== opt)
                                setAttrValues((prev) => ({
                                  ...prev,
                                  [def.attributeKey]: next.join(','),
                                }))
                              }}
                              className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                            />
                            {opt}
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <input
                      type={
                        def.dataType === 'number'
                          ? 'number'
                          : def.dataType === 'date'
                            ? 'date'
                            : 'text'
                      }
                      value={attrValues[def.attributeKey] ?? def.defaultValue ?? ''}
                      placeholder={def.defaultValue ?? ''}
                      onChange={(e) =>
                        setAttrValues((prev) => ({ ...prev, [def.attributeKey]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                </div>
              ))}
            </FormSection>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isSubmitting || isAttributeSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isAttributeSubmitting}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {(isSubmitting || isAttributeSubmitting) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isSubmitting || isAttributeSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
