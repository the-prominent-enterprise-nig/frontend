'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Upload, ImageOff, Images } from 'lucide-react'
import { CreateItemFormSchema, CreateItemFormValues, UomOption } from '@/src/schema/inventory/items'
import type {
  ItemTagLabel,
  ItemGroupOption,
  ItemSubgroupOption,
  ClassificationOption,
} from '@/src/schema/inventory/items'
import { ALL_TAGS, DIMENSION_FIELDS, NumericInput, FormSection } from './item-form-shared'
import type { ApiResponse } from '@/src/libs/api/client'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { TaxRates, type TaxRate } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import { showToast } from '@/src/components/ui/toast'
import { uploadItemFile, addItemImage } from '../_actions/item-images'
import { addItemTag } from '../_actions/item-tags'

interface PendingImage {
  fileId: string
  previewUrl: string
  name: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateItemFormValues) => Promise<ApiResponse<{ id?: string }>>
  isSubmitting: boolean
  categories: CategorySelectOption[]
  uomOptions: UomOption[]
  groupOptions: ItemGroupOption[]
  subgroupOptions: ItemSubgroupOption[]
  brandOptions: ClassificationOption[]
  typeOptions: ClassificationOption[]
}

export default function CreateItemModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  categories,
  uomOptions,
  groupOptions,
  subgroupOptions,
  brandOptions,
  typeOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    setFocus,
    formState: { errors, isDirty, submitCount },
  } = useForm<CreateItemFormValues>({
    resolver: zodResolver(CreateItemFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      description: '',
      baseUnitId: '',
      primaryCategoryId: '',
      costingMethod: 'weighted_average',
      isBatchTracked: false,
      isSerialTracked: true,
      requiresSecondarySerial: false,
      isExpiryTracked: false,
      isBundle: false,
      hasVariants: false,
      taxRateId: undefined,
    },
  })

  const [selectedTags, setSelectedTags] = useState<ItemTagLabel[]>([])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasUnsavedChanges = isDirty || pendingImages.length > 0 || selectedTags.length > 0

  const selectedGroupId = useWatch({ control, name: 'groupId' })
  const filteredSubgroups = subgroupOptions.filter(
    (s) => !selectedGroupId || s.groupId === selectedGroupId
  )

  useEffect(() => {
    const currentSub = getValues('subgroupId')
    if (!currentSub) return
    const valid = filteredSubgroups.some((s) => s.id === currentSub)
    if (!valid) setValue('subgroupId', undefined)
  }, [selectedGroupId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!isOpen) {
      reset()
      setSelectedTags([])
      setConfirmingClose(false)
      setPendingImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.previewUrl))
        return []
      })
    }
  }, [isOpen, reset])

  useEffect(() => {
    if (submitCount === 0) return
    const firstErrorKey = Object.keys(errors)[0] as keyof CreateItemFormValues | undefined
    if (!firstErrorKey) return
    const t = setTimeout(() => {
      try {
        setFocus(firstErrorKey)
      } catch {}
    }, 50)
    return () => clearTimeout(t)
  }, [submitCount, errors, setFocus])

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const previewUrl = URL.createObjectURL(file)
    setImageUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadItemFile(formData)
      if (!result.success || !result.data) {
        URL.revokeObjectURL(previewUrl)
        showToast({ title: 'Upload failed', description: result.message, status: 'error' })
        return
      }
      setPendingImages((prev) => [
        ...prev,
        { fileId: result.data!.id, previewUrl, name: file.name },
      ])
    } finally {
      setImageUploading(false)
    }
  }

  function removePendingImage(fileId: string) {
    setPendingImages((prev) => {
      const img = prev.find((i) => i.fileId === fileId)
      if (img) URL.revokeObjectURL(img.previewUrl)
      return prev.filter((i) => i.fileId !== fileId)
    })
  }

  // ACC-21: lazy-load accounts + tax rates when modal opens
  const [accounts, setAccounts] = useState<Account[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  useEffect(() => {
    if (!isOpen) return
    ;(async () => {
      const [a, t] = await Promise.all([getAccounts({ limit: 500 }), TaxRates.list(true)])
      const aData = a.data as any
      setAccounts((aData?.items ?? aData ?? []) as Account[])
      const activeTaxRates = (t.data ?? []).filter((r) => r.isActive)
      setTaxRates(activeTaxRates)
      if (activeTaxRates.length > 0) {
        setValue('taxRateId', activeTaxRates[0].id)
      }
    })()
  }, [isOpen, setValue])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateItemFormValues) {
    const result = await onSubmit(data)
    if (!result.success) {
      if (result.error === 'duplicate_sku') {
        setError('sku', { type: 'manual', message: result.message ?? 'SKU already exists' })
      }
      return
    }

    const newItemId = result.data?.id
    if (newItemId) {
      await Promise.all([
        ...pendingImages.map((img) => addItemImage(newItemId, { fileId: img.fileId })),
        ...selectedTags.map((tag) => addItemTag(newItemId, tag)),
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
      <div
        ref={scrollRef}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Add New Item</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Fill in the details below — required fields are marked *
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
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
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
                    placeholder="e.g. Wireless Mouse"
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
                    placeholder="e.g. ITEM-0001"
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
                    placeholder="Optional item description…"
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
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

            {/* Costing Method */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Costing Method</label>
              <Controller
                name="costingMethod"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="weighted_average">Weighted Average</option>
                    <option value="fifo">FIFO</option>
                    <option value="lifo">LIFO</option>
                  </select>
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
          </FormSection>

          {/* Tracking */}
          <FormSection title="Tracking" defaultOpen={true}>
            <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  { name: 'isBatchTracked', label: 'Batch Tracking' },
                  { name: 'isSerialTracked', label: 'Serial Tracking' },
                  { name: 'requiresSecondarySerial', label: 'Dual Serial (Indoor + Outdoor)' },
                  { name: 'isExpiryTracked', label: 'Expiry Tracking' },
                  { name: 'isBundle', label: 'Bundle Item' },
                ] as const
              ).map(({ name, label }) => (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="accent-prominent-purple-600"
                      />
                      {label}
                    </label>
                  )}
                />
              ))}
            </div>
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
                      onChange={(e) =>
                        setSelectedTags((prev) =>
                          e.target.checked ? [...prev, value] : prev.filter((t) => t !== value)
                        )
                      }
                      className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </FormSection>

          {/* Classification */}
          <FormSection title="Classification" defaultOpen={false}>
            {/* Group */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Group</label>
              <Controller
                name="groupId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">— None —</option>
                    {groupOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Subgroup */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Subgroup</label>
              <Controller
                name="subgroupId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    disabled={!selectedGroupId}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    <option value="">
                      {selectedGroupId ? '— None —' : '— Select group first —'}
                    </option>
                    {filteredSubgroups.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Brand */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Brand</label>
              <Controller
                name="brandId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">— None —</option>
                    {brandOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Item Type */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Item Type</label>
              <Controller
                name="typeId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">— None —</option>
                    {typeOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
          </FormSection>

          {/* Images */}
          <FormSection title="Images" defaultOpen={true}>
            <div className="sm:col-span-2">
              <div className="mb-2 flex items-center gap-2">
                <Images className="h-4 w-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-700">Item Images</span>
                <span className="text-xs text-zinc-400">(optional)</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {pendingImages.map((img, idx) => (
                  <PendingThumbnail
                    key={img.fileId}
                    img={img}
                    isPrimary={idx === 0}
                    onRemove={() => removePendingImage(img.fileId)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition-colors hover:border-prominent-purple-400 hover:bg-prominent-purple-50 hover:text-prominent-purple-600 disabled:opacity-50"
                >
                  {imageUploading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-prominent-purple-600" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Add Image</span>
                    </>
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
          </FormSection>

          {/* ACC-21: Accounting overrides (optional) — outside sections, inside form */}
          <div className="px-6 pb-4 pt-2">
            <details className="rounded-lg border border-zinc-200 bg-zinc-50/40">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                Accounting (optional)
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  — override default revenue/COGS/inventory accounts + tax rate
                </span>
              </summary>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                <AccountField
                  label="Revenue Account"
                  name="revenueAccountId"
                  control={control}
                  accounts={accounts}
                  filter="REVENUE"
                />
                <AccountField
                  label="COGS Account"
                  name="cogsAccountId"
                  control={control}
                  accounts={accounts}
                  filter="EXPENSE"
                />
                <AccountField
                  label="Inventory Account"
                  name="inventoryAccountId"
                  control={control}
                  accounts={accounts}
                  filter="ASSET"
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Tax Rate</label>
                  <Controller
                    name="taxRateId"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        value={field.value != null ? String(field.value) : ''}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      >
                        <option value="">— Use default —</option>
                        {taxRates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} — {t.name} ({Number(t.ratePercent).toFixed(2)}%)
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={handleRequestClose}
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
              {isSubmitting ? 'Saving…' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PendingThumbnail({
  img,
  isPrimary,
  onRemove,
}: {
  img: PendingImage
  isPrimary: boolean
  onRemove: () => void
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      {imgError ? (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOff className="h-6 w-6 text-zinc-300" />
        </div>
      ) : (
        <img
          src={img.previewUrl}
          alt={img.name}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
      {isPrimary && (
        <div className="absolute left-1.5 top-1.5 rounded-full bg-prominent-purple-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Primary
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
        aria-label="Remove image"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// ACC-21: dropdown of accounts filtered by type, controlled by react-hook-form
function AccountField({
  label,
  name,
  control,
  accounts,
  filter,
}: {
  label: string
  name: 'revenueAccountId' | 'cogsAccountId' | 'inventoryAccountId'
  control: any
  accounts: Account[]
  filter?: string
}) {
  const filtered = filter
    ? accounts.filter((a) => String((a as any).type).toUpperCase() === filter)
    : accounts
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <select
            {...field}
            value={field.value != null ? String(field.value) : ''}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          >
            <option value="">— Use default mapping —</option>
            {filtered.map((a) => (
              <option key={a.id} value={a.id}>
                {(a as any).number ?? a.code} — {a.name}
              </option>
            ))}
          </select>
        )}
      />
      \{' '}
    </div>
  )
}
