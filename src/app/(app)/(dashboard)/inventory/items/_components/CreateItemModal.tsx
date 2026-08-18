'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Upload, ImageOff, Images, PackagePlus } from 'lucide-react'
import { CreateItemFormSchema, CreateItemFormValues, UomOption } from '@/src/schema/inventory/items'
import type { ItemTagLabel, ClassificationOption } from '@/src/schema/inventory/items'
import {
  ALL_TAGS,
  DIMENSION_FIELDS,
  NumericInput,
  FormSection,
  AccountField,
} from './item-form-shared'
import { formatClassificationLabel } from '@/src/libs/format/text'
import type { ApiResponse } from '@/src/libs/api/client'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import {
  getAccounts,
  getTaxRates,
  type Account,
  type TaxRate,
} from '@/src/libs/data/AccountingData'
import { showToast } from '@/src/components/ui/toast'
import { uploadItemFile, addItemImage } from '../_actions/item-images'
import { addItemTag } from '../_actions/item-tags'
import { checkItemDuplicates } from '../_actions/check-item-duplicates'
import type { DuplicateCandidate } from '@/src/schema/inventory/items'
import { receiveInitialUnit } from '../_actions/receive-initial-unit'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'

interface PendingImage {
  fileId: string
  previewUrl: string
  name: string
}

// Tracking checkboxes that don't apply to service items and get disabled + cleared
// when "Service Item" is checked.
const TRACKING_FIELDS_DISABLED_BY_SERVICE = [
  'isBatchTracked',
  'isSerialTracked',
  'requiresSecondarySerial',
  'isExpiryTracked',
] as const

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateItemFormValues) => Promise<ApiResponse<{ id?: string }>>
  isSubmitting: boolean
  categories: CategorySelectOption[]
  uomOptions: UomOption[]
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
  brandOptions,
  typeOptions,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    setFocus,
    formState: { errors, isDirty, submitCount },
  } = useForm<CreateItemFormValues>({
    resolver: zodResolver(CreateItemFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      description: '',
      modelNumber: '',
      baseUnitId: '',
      primaryCategoryId: '',
      costingMethod: 'weighted_average',
      isBatchTracked: false,
      isSerialTracked: true,
      requiresSecondarySerial: false,
      isExpiryTracked: false,
      isBundle: false,
      hasVariants: false,
      isService: false,
      taxRateId: undefined,
      initialWarehouseId: '',
      initialDateIn: '',
      initialRr: '',
      initialOrigin: '',
      initialPrice: undefined,
      initialSerialNumber: '',
    },
  })

  const [selectedTags, setSelectedTags] = useState<ItemTagLabel[]>([])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasUnsavedChanges = isDirty || pendingImages.length > 0 || selectedTags.length > 0

  // Service items never carry stock/serial tracking — force-clear + disable those
  // checkboxes whenever "Service Item" is checked.
  const isServiceValue = useWatch({ control, name: 'isService' })
  useEffect(() => {
    if (!isServiceValue) return
    TRACKING_FIELDS_DISABLED_BY_SERVICE.forEach((name) => setValue(name, false))
  }, [isServiceValue, setValue])

  // Scenario 16 gap #3: non-blocking near-duplicate warning, debounced as the
  // name is typed — never blocks submission, only informs.
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])
  const nameValue = useWatch({ control, name: 'name' })
  const brandIdValue = useWatch({ control, name: 'brandId' })
  useEffect(() => {
    if (!isOpen || !nameValue || nameValue.trim().length < 3) {
      setDuplicates([])
      return
    }
    const timer = setTimeout(async () => {
      const result = await checkItemDuplicates(nameValue, brandIdValue)
      if (result.success) setDuplicates(result.data ?? [])
    }, 400)
    return () => clearTimeout(timer)
  }, [isOpen, nameValue, brandIdValue])

  const isSerialTrackedValue = useWatch({ control, name: 'isSerialTracked' })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  })
  const warehouses = warehousesQuery.data?.data?.data ?? []

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
      const [a, t] = await Promise.all([getAccounts({ limit: 500 }), getTaxRates()])
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

      if (data.initialWarehouseId && data.initialDateIn && data.initialRr) {
        const initialStockResult = await receiveInitialUnit(newItemId, {
          warehouseId: data.initialWarehouseId,
          dateIn: data.initialDateIn,
          rr: data.initialRr,
          origin: data.initialOrigin || undefined,
          price: data.initialPrice,
          serialNumber: data.initialSerialNumber || undefined,
        })
        if (!initialStockResult.success) {
          showToast({
            title: 'Item created, but initial stock failed',
            description: initialStockResult.message,
            status: 'error',
          })
        }
      }
    }

    onClose()
  }

  const basicInfoErrors = [
    errors.name,
    errors.sku,
    errors.baseUnitId,
    errors.primaryCategoryId,
  ].filter(Boolean).length

  const pricingErrors = [errors.costPrice].filter(Boolean).length

  const hasSubmitErrors = submitCount > 0 && Object.keys(errors).length > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add New Item"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div
        ref={scrollRef}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
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

        {/* Governance notice (Scenario 16) */}
        <div className="border-b border-blue-100 bg-blue-50 px-6 py-2.5">
          <p className="text-xs text-blue-800">
            This item saves as a <span className="font-medium">draft</span>. Submit it for
            Accounting confirmation and Master Data Approver sign-off before it becomes available in
            PO, receiving, inventory, and POS.
          </p>
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
              {duplicates.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-medium text-amber-800">
                    {duplicates.length} similar item{duplicates.length !== 1 ? 's' : ''} found —
                    review before creating:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {duplicates.map((d) => (
                      <li key={d.id} className="text-xs text-amber-700">
                        <span className="font-mono">{d.sku}</span> — {d.name}
                        {d.brandName ? ` (${d.brandName})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                        {formatClassificationLabel(t.name)}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Model Number */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Model Number</label>
              <Controller
                name="modelNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. KFM36E0W"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
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
                          {t.name} ({Number(t.rate).toFixed(2)}%)
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
                  { name: 'isService', label: 'Service Item (no stock/serial tracking)' },
                ] as const
              ).map(({ name, label }) => {
                const isDisabled =
                  isServiceValue &&
                  (TRACKING_FIELDS_DISABLED_BY_SERVICE as readonly string[]).includes(name)
                return (
                  <Controller
                    key={name}
                    name={name}
                    control={control}
                    render={({ field }) => (
                      <label
                        className={`flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 ${
                          isDisabled
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:bg-zinc-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={field.value}
                          disabled={isDisabled}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="accent-prominent-purple-600"
                        />
                        {label}
                      </label>
                    )}
                  />
                )
              })}
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

          {/* Initial Stock */}
          <FormSection title="Initial Stock (Optional)" defaultOpen={false}>
            <div className="sm:col-span-2 -mt-1 mb-1 flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              <PackagePlus className="h-4 w-4 shrink-0 text-zinc-400" />
              Record one already-in-hand unit for this item right now — e.g. pasting in a single row
              from a legacy stock sheet. Leave blank to create the item with no stock.
            </div>

            {/* Branch */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Branch</label>
              <Controller
                name="initialWarehouseId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  >
                    <option value="">— None —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.branch?.name ?? w.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.initialWarehouseId && (
                <p className="mt-1 text-xs text-red-600">{errors.initialWarehouseId.message}</p>
              )}
            </div>

            {/* Date In */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Date In</label>
              <Controller
                name="initialDateIn"
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
              {errors.initialDateIn && (
                <p className="mt-1 text-xs text-red-600">{errors.initialDateIn.message}</p>
              )}
            </div>

            {/* RR # */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">RR #</label>
              <Controller
                name="initialRr"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="text"
                    placeholder="e.g. RR#163451S"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
              {errors.initialRr && (
                <p className="mt-1 text-xs text-red-600">{errors.initialRr.message}</p>
              )}
            </div>

            {/* Origin */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Origin</label>
              <Controller
                name="initialOrigin"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="text"
                    placeholder="Supplier name, or WHSE"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                )}
              />
            </div>

            {/* Price */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Unit Price (₱)</label>
              <Controller
                name="initialPrice"
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

            {/* Serial Number — only when this item is serial-tracked */}
            {isSerialTrackedValue && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Serial Number
                </label>
                <Controller
                  name="initialSerialNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="text"
                      placeholder="e.g. GT248004"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                />
                {errors.initialSerialNumber && (
                  <p className="mt-1 text-xs text-red-600">{errors.initialSerialNumber.message}</p>
                )}
              </div>
            )}
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
                            {t.name} ({Number(t.rate).toFixed(2)}%)
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
