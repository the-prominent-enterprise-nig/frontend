'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Upload, ImageOff, Images, PackagePlus } from 'lucide-react'
import { CreateItemFormSchema, CreateItemFormValues, UomOption } from '@/src/schema/inventory/items'
import type { ClassificationOption } from '@/src/schema/inventory/items'
import { NumericInput, FormSection } from './item-form-shared'
import type { ApiResponse } from '@/src/libs/api/client'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { uploadItemFile, addItemImage } from '../_actions/item-images'
import { checkItemDuplicates } from '../_actions/check-item-duplicates'
import type { DuplicateCandidate } from '@/src/schema/inventory/items'
import { receiveInitialUnit } from '../_actions/receive-initial-unit'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { CONTROL_CHROME, MONO, PLEX } from '@/src/libs/design/plex'
import {
  UNIT_CLASSIFICATION_LABELS,
  UnitClassificationSchema,
} from '@/src/schema/inventory/reports'
import { errorClass, inputClass, labelClass } from './itemFormChrome'
import { CategorySubgroupFields, useAutoItemName, useOriginOptions } from './item-create-fields'

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
  /**
   * 'overlay' (default) covers the content area with its own close button.
   * 'page' renders in the flow of a hub tab — Master Data's Add Item, the
   * Stock Request pattern — with no close/cancel; onClose then means "start
   * a fresh form" and is called after a successful save.
   */
  variant?: 'overlay' | 'page'
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
  variant = 'overlay',
}: Props) {
  const isPage = variant === 'page'
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
      typeId: '',
      costingMethod: 'weighted_average',
      isBatchTracked: false,
      isSerialTracked: true,
      requiresSecondarySerial: false,
      isExpiryTracked: false,
      isBundle: false,
      isService: false,
      initialWarehouseId: '',
      initialDateIn: '',
      initialRr: '',
      initialOrigin: '',
      initialPrice: undefined,
      initialSerialNumber: '',
      initialClassification: 'brand_new',
    },
  })

  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasUnsavedChanges = isDirty || pendingImages.length > 0

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
  const originOptions = useOriginOptions(isOpen)

  const [categoryName, setCategoryName] = useState('')
  const { onNameTyped } = useAutoItemName({
    control,
    setValue,
    brandOptions,
    categoryName,
    validate: submitCount > 0,
    active: isOpen,
  })

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
      ])

      if (data.initialWarehouseId && data.initialDateIn && data.initialRr) {
        const initialStockResult = await receiveInitialUnit(newItemId, {
          warehouseId: data.initialWarehouseId,
          dateIn: data.initialDateIn,
          rr: data.initialRr,
          origin: data.initialOrigin || undefined,
          price: data.initialPrice,
          serialNumber: data.initialSerialNumber || undefined,
          classification: data.initialClassification,
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
    errors.typeId,
    errors.brandId,
    errors.modelNumber,
  ].filter(Boolean).length

  const pricingErrors = [errors.costPrice, errors.sellingPrice].filter(Boolean).length

  const hasSubmitErrors = submitCount > 0 && Object.keys(errors).length > 0

  return (
    <div
      role={isPage ? 'region' : 'dialog'}
      aria-modal={isPage ? undefined : true}
      aria-label="Add New Item"
      // Scenario 56 — full-content page (the CreatePoModal shape): fills the
      // area beside the sidebar, which stays visible and usable. As a hub tab
      // it sits in the page flow under the (sticky) tab strip instead. Same
      // shell as Stock Transaction's New Stock Request.
      className={`${isPage ? 'flex-1' : 'absolute inset-0 z-50'} flex flex-col bg-[#f2f2f3] ${PLEX}`}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-[#e4e4e9] bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`${MONO} mb-1 text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle`}>
              Inventory &rsaquo; Master data &rsaquo; New item
            </p>
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#17171c]">
              Add New Item
            </h2>
            {/* A new item starts with no stock, so it is approved on save —
                no Scenario 16 draft → accounting → approver chain. */}
            <p className="mt-1 text-[13px] text-[#4b4b5a]">
              Ready to use in PO, receiving and POS as soon as it&apos;s saved. It starts with no
              stock unless you record initial stock below.
            </p>
          </div>
          {!isPage && (
            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="Close"
              className="rounded-lg p-2 text-[#4b4b5a] hover:bg-[#f1f1f4]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      {confirmingClose && (
        <div className="flex shrink-0 items-center justify-between border-b border-[#f5dcb0] bg-[#fdf3e2] px-6 py-3">
          <p className="text-[13px] text-[#8a4b06]">You have unsaved changes. Discard them?</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmingClose(false)}
              className="text-[13px] font-medium text-[#4b4b5a] hover:text-[#17171c]"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={handleConfirmDiscard}
              className="text-[13px] font-medium text-[#b42318] hover:text-[#8f1c14]"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        noValidate
        className={`flex flex-1 flex-col ${isPage ? '' : 'overflow-hidden'}`}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
            {/* Basic Info */}
            <FormSection
              variant="card"
              title="Basic Info"
              defaultOpen={true}
              errorCount={basicInfoErrors}
              forceOpen={hasSubmitErrors && basicInfoErrors > 0}
            >
              {/* Item Name */}
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Item Name <span className="text-[#b42318]">*</span>
                </label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. Kolin Airconditioner KFM36E0W"
                      className={inputClass}
                      onChange={(e) => {
                        field.onChange(e)
                        onNameTyped(e.target.value)
                      }}
                    />
                  )}
                />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
                {duplicates.length > 0 && (
                  <div className="mt-2 rounded-lg border border-[#f5dcb0] bg-[#fdf3e2] px-3 py-2">
                    <p className="text-[12px] font-medium text-[#8a4b06]">
                      {duplicates.length} similar item{duplicates.length !== 1 ? 's' : ''} found —
                      review before creating:
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {duplicates.map((d) => (
                        <li key={d.id} className="text-[12px] text-[#8a4b06]">
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
                <label className={labelClass}>
                  SKU <span className="text-[#b42318]">*</span>
                </label>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. ITEM-0001"
                      className={`${inputClass} uppercase`}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  )}
                />
                {errors.sku && <p className={errorClass}>{errors.sku.message}</p>}
              </div>

              {/* Unit of Measure */}
              <div>
                <label className={labelClass}>
                  Unit of Measure <span className="text-[#b42318]">*</span>
                </label>
                <Controller
                  name="baseUnitId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      chrome={CONTROL_CHROME}
                      portal
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={uomOptions.map((uom) => ({
                        value: uom.id,
                        label: `${uom.code} – ${uom.name}`,
                      }))}
                      placeholder="Select unit…"
                      loading={uomOptions.length === 0}
                      loadingLabel="Loading units…"
                    />
                  )}
                />
                {errors.baseUnitId && <p className={errorClass}>{errors.baseUnitId.message}</p>}
              </div>

              {/* Type — required: it routes the item's GL
                lines and its report row (Appliances, Furniture, IT…). */}
              <div>
                <label className={labelClass}>
                  Type <span className="text-[#b42318]">*</span>
                </label>
                <Controller
                  name="typeId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      chrome={CONTROL_CHROME}
                      portal
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={typeOptions.map((t) => ({ value: t.id, label: t.name }))}
                      placeholder="Select type…"
                      loading={typeOptions.length === 0}
                      loadingLabel="Loading types…"
                    />
                  )}
                />
                {errors.typeId && <p className={errorClass}>{errors.typeId.message}</p>}
              </div>

              {/* Category + Subgroup — Item Master's two columns. */}
              <CategorySubgroupFields
                control={control}
                categories={categories}
                error={errors.primaryCategoryId?.message}
                onCategoryNameChange={setCategoryName}
              />

              {/* Brand */}
              <div>
                <label className={labelClass}>
                  Brand {!isServiceValue && <span className="text-[#b42318]">*</span>}
                </label>
                <Controller
                  name="brandId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      chrome={CONTROL_CHROME}
                      portal
                      value={field.value ?? ''}
                      onChange={(value) => field.onChange(value || undefined)}
                      options={brandOptions.map((b) => ({ value: b.id, label: b.name }))}
                      placeholder="Select brand…"
                      clearable
                    />
                  )}
                />
                {errors.brandId && <p className={errorClass}>{errors.brandId.message}</p>}
              </div>

              {/* Model Number — shares a row with Brand. */}
              <div>
                <label className={labelClass}>
                  Model Number {!isServiceValue && <span className="text-[#b42318]">*</span>}
                </label>
                <Controller
                  name="modelNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. KFM36E0W"
                      className={inputClass}
                    />
                  )}
                />
                {errors.modelNumber && <p className={errorClass}>{errors.modelNumber.message}</p>}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className={labelClass}>Description</label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      value={field.value ?? ''}
                      rows={3}
                      placeholder="Optional item description…"
                      className={`${inputClass} resize-none`}
                    />
                  )}
                />
              </div>
            </FormSection>

            {/* Pricing */}
            <FormSection
              variant="card"
              title="Pricing"
              defaultOpen={true}
              errorCount={pricingErrors}
              forceOpen={hasSubmitErrors && pricingErrors > 0}
            >
              {/* Cost Price */}
              <div>
                <label className={labelClass}>
                  Cost Price (₱) <span className="text-[#b42318]">*</span>
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
                      className={inputClass}
                    />
                  )}
                />
                {errors.costPrice && <p className={errorClass}>{errors.costPrice.message}</p>}
              </div>

              {/* Selling Price — Item Master's Price column. */}
              <div>
                <label className={labelClass}>Selling Price (₱)</label>
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
                      className={inputClass}
                    />
                  )}
                />
                {errors.sellingPrice && <p className={errorClass}>{errors.sellingPrice.message}</p>}
              </div>
            </FormSection>

            {/* Tracking */}
            <FormSection variant="card" title="Tracking" defaultOpen={true}>
              <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    { name: 'isSerialTracked', label: 'Serial Tracking' },
                    { name: 'requiresSecondarySerial', label: 'Dual Serial (Indoor + Outdoor)' },
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
                          className={`flex items-center gap-2 rounded-lg border border-[#e4e4e9] px-3 py-2 text-[13px] text-[#3d3d4a] ${
                            isDisabled
                              ? 'cursor-not-allowed opacity-50'
                              : 'cursor-pointer hover:bg-[#fbfbfc]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={field.value}
                            disabled={isDisabled}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="accent-[#5b21b6]"
                          />
                          {label}
                        </label>
                      )}
                    />
                  )
                })}
              </div>
            </FormSection>

            {/* Initial Stock */}
            <FormSection variant="card" title="Initial Stock (Optional)" defaultOpen={true}>
              <div className="sm:col-span-2 -mt-1 mb-1 flex items-start gap-2 rounded-lg border border-[#eeeef1] bg-[#fbfbfc] px-3 py-2 text-[12px] text-[#4b4b5a]">
                <PackagePlus className="h-4 w-4 shrink-0 text-ink-faint" />
                Record one already-in-hand unit for this item right now — e.g. pasting in a single
                row from a legacy stock sheet. Leave blank to create the item with no stock.
              </div>

              {/* Warehouse — a branch's warehouse, labelled by branch. */}
              <div>
                <label className={labelClass}>Warehouse</label>
                <Controller
                  name="initialWarehouseId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      chrome={CONTROL_CHROME}
                      portal
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={warehouses.map((w) => ({
                        value: w.id,
                        label: w.branch?.name ?? w.name,
                      }))}
                      placeholder="Select warehouse…"
                      clearable
                    />
                  )}
                />
                {errors.initialWarehouseId && (
                  <p className={errorClass}>{errors.initialWarehouseId.message}</p>
                )}
              </div>

              {/* Date In */}
              <div>
                <label className={labelClass}>Date In</label>
                <Controller
                  name="initialDateIn"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="date"
                      className={inputClass}
                    />
                  )}
                />
                {errors.initialDateIn && (
                  <p className={errorClass}>{errors.initialDateIn.message}</p>
                )}
              </div>

              {/* RR # */}
              <div>
                <label className={labelClass}>RR #</label>
                <Controller
                  name="initialRr"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="text"
                      placeholder="e.g. RR#163451S"
                      className={inputClass}
                    />
                  )}
                />
                {errors.initialRr && <p className={errorClass}>{errors.initialRr.message}</p>}
              </div>

              {/* Origin — a supplier on file, or WHSE for internal stock. */}
              <div>
                <label className={labelClass}>Origin</label>
                <Controller
                  name="initialOrigin"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      chrome={CONTROL_CHROME}
                      portal
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={originOptions}
                      placeholder="Select supplier or WHSE…"
                      clearable
                    />
                  )}
                />
              </div>

              {/* Classification — the General Stockbook's Brand New / Repair / Repo / Return. */}
              <div>
                <label className={labelClass}>Classification</label>
                <Controller
                  name="initialClassification"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      chrome={CONTROL_CHROME}
                      portal
                      value={field.value ?? 'brand_new'}
                      onChange={(v) => field.onChange(v || 'brand_new')}
                      options={UnitClassificationSchema.options.map((c) => ({
                        value: c,
                        label: UNIT_CLASSIFICATION_LABELS[c],
                      }))}
                    />
                  )}
                />
              </div>

              {/* Unit cost — the General Stockbook's Cost column. */}
              <div>
                <label className={labelClass}>Unit Cost (₱)</label>
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
                      className={inputClass}
                    />
                  )}
                />
              </div>

              {/* Serial Number — only when this item is serial-tracked */}
              {isSerialTrackedValue && (
                <div>
                  <label className={labelClass}>Serial Number</label>
                  <Controller
                    name="initialSerialNumber"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        value={field.value ?? ''}
                        type="text"
                        placeholder="e.g. GT248004"
                        className={inputClass}
                      />
                    )}
                  />
                  {errors.initialSerialNumber && (
                    <p className={errorClass}>{errors.initialSerialNumber.message}</p>
                  )}
                </div>
              )}
            </FormSection>

            {/* Images */}
            <FormSection variant="card" title="Images" defaultOpen={true}>
              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center gap-2">
                  <Images className="h-4 w-4 text-ink-faint" />
                  <span className="text-[12px] font-medium text-[#3d3d4a]">Item Images</span>
                  <span className="text-[12px] text-ink-faint">(optional)</span>
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
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#d3d3db] bg-[#fbfbfc] text-ink-faint transition-colors hover:border-[#5b21b6] hover:bg-[#f0e9fc] hover:text-[#5b21b6] disabled:opacity-50"
                  >
                    {imageUploading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d3d3db] border-t-[#5b21b6]" />
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
          </div>
        </div>

        {/* Sticky footer — same bar as the New Stock Request form */}
        <div
          className={`flex shrink-0 items-center justify-between gap-4 border-t border-[#e4e4e9] bg-white px-6 py-3.5 ${isPage ? 'sticky bottom-0' : ''}`}
        >
          <span className="hidden text-[12px] text-[#4b4b5a] sm:block">
            Required fields are marked <span className="text-[#b42318]">*</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            {!isPage && (
              <button
                type="button"
                onClick={handleRequestClose}
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#4b4b5a] hover:bg-[#f1f1f4] disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : 'Create Item'}
            </button>
          </div>
        </div>
      </form>
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
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-[#e4e4e9] bg-[#fbfbfc]">
      {imgError ? (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOff className="h-6 w-6 text-ink-faint" />
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
        <div className="absolute left-1.5 top-1.5 rounded-full bg-[#5b21b6] px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
