'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, FileUp } from 'lucide-react'
import { CreateItemFormSchema, CreateItemFormValues, UomOption } from '@/src/schema/inventory/items'
import type { ClassificationOption } from '@/src/schema/inventory/items'
import { NumericInput, FormSection } from './item-form-shared'
import type { ApiResponse } from '@/src/libs/api/client'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { checkItemDuplicates } from '../_actions/check-item-duplicates'
import type { DuplicateCandidate } from '@/src/schema/inventory/items'
import { setItemPrices } from '../_actions/set-item-prices'
import ItemPricesSection, { type PricesFormValues } from './ItemPricesSection'
import BulkImportItemsModal from './BulkImportItemsModal'
import { PRIMARY_BUTTON } from '../../master-data/_components/masterDataChrome'
import { useMe } from '@/src/hooks/useMe'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { toItemPricePayload, type ItemPriceEntry } from '@/src/schema/inventory/items/item-prices'
import { CONTROL_CHROME, MONO, PLEX } from '@/src/libs/design/plex'
import { errorClass, inputClass, labelClass } from './itemFormChrome'
import { quickAddAction, useQuickAddClassification } from './useQuickAddClassification'
import { CategorySubgroupFields, useAutoItemName } from './item-create-fields'

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
   * Stock Request pattern — with no close/cancel; onClose is then only
   * called after a successful save (Add Item uses it to go to Item Master).
   */
  variant?: 'overlay' | 'page'
  /** Called after a successful save in place of onClose — Add Item uses it
   * to go on to the new item's Add units. */
  onSaved?: (item: { id?: string; isService: boolean }) => void
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
  onSaved,
}: Props) {
  const isPage = variant === 'page'
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
      isFreebie: false,
      prices: [],
    },
  })

  const [confirmingClose, setConfirmingClose] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasUnsavedChanges = isDirty

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

  // UOM isn't on the form — every new item is PCS (the unit nearly the whole
  // catalogue uses), falling back to the first base unit if PCS is missing.
  const baseUnitIdValue = useWatch({ control, name: 'baseUnitId' })
  useEffect(() => {
    if (baseUnitIdValue) return
    const defaultUnit = pickDefaultUnit(uomOptions)
    if (defaultUnit) setValue('baseUnitId', defaultUnit.id)
  }, [baseUnitIdValue, uomOptions, setValue])

  const { data: me } = useMe()
  const canSetPrices = hasPermission(me ?? null, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)

  const [categoryName, setCategoryName] = useState('')
  const addBrand = useQuickAddClassification('brand')
  const addType = useQuickAddClassification('type')
  // A quick-added brand/type is picked at once; its toast's Undo lets go of
  // it again — unless something else has been picked since.
  const pick = { shouldDirty: true, shouldValidate: submitCount > 0 }
  const brandAction = quickAddAction(
    addBrand,
    'brand',
    ({ id }) => setValue('brandId', id, pick),
    (id) => getValues('brandId') === id && setValue('brandId', undefined, pick)
  )
  const typeAction = quickAddAction(
    addType,
    'type',
    ({ id }) => setValue('typeId', id, pick),
    (id) => getValues('typeId') === id && setValue('typeId', '', pick)
  )
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
    if (newItemId && data.prices?.length) await savePrices(newItemId, data.prices)

    if (onSaved) onSaved({ id: newItemId, isService: data.isService })
    else onClose()
  }

  /** Prices are a second call once the item exists; a failure there keeps
   * the item and says what didn't stick. */
  async function savePrices(itemId: string, prices: ItemPriceEntry[]): Promise<void> {
    const res = await setItemPrices(itemId, prices.map(toItemPricePayload))
    if (!res.success || !res.data) {
      showToast({
        title: 'Item created, but prices failed',
        description: res.message,
        status: 'error',
      })
      return
    }
    const notSaved = res.data.rows.filter((r) => r.status !== 'create' && r.status !== 'update')
    if (notSaved.length > 0) {
      showToast({
        title: 'Some prices were not saved',
        description: notSaved.map((r) => r.message).join(' · '),
        status: 'error',
      })
    }
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

  const pricingErrors = [errors.costPrice].filter(Boolean).length

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
              stock — you&apos;ll add its units next.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Many items at once — the same sheet also prices them and
                records their units (item upload template). */}
            <button
              type="button"
              onClick={() => setIsBulkUploadOpen(true)}
              className={PRIMARY_BUTTON}
            >
              <FileUp className="h-4 w-4" />
              Bulk Upload Items
            </button>
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
      </div>
      <BulkImportItemsModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        canSetPrices={canSetPrices}
      />
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
                      emptyAction={brandAction}
                    />
                  )}
                />
                {errors.brandId && <p className={errorClass}>{errors.brandId.message}</p>}
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
                      emptyAction={typeAction}
                    />
                  )}
                />
                {errors.typeId && <p className={errorClass}>{errors.typeId.message}</p>}
              </div>

              {/* Category + Subgroup — Item Master's two columns. */}
              <Controller
                name="primaryCategoryId"
                control={control}
                render={({ field }) => (
                  <CategorySubgroupFields
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    categories={categories}
                    error={errors.primaryCategoryId?.message}
                    getValue={() => getValues('primaryCategoryId') ?? ''}
                    onCategoryNameChange={setCategoryName}
                  />
                )}
              />

              {/* Model Number */}
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
            </FormSection>

            {/* Cost — the selling price lives on the price lists (Prices section). */}
            <FormSection
              variant="card"
              title="Cost"
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
            </FormSection>

            {/* Tracking */}
            <FormSection variant="card" title="Tracking" defaultOpen={true}>
              <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    { name: 'isSerialTracked', label: 'Serial Tracking' },
                    { name: 'isService', label: 'Service Item (no stock/serial tracking)' },
                    { name: 'isFreebie', label: 'Freebie' },
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

            {canSetPrices && (
              <FormSection
                variant="card"
                title="Prices (Optional)"
                defaultOpen={true}
                errorCount={errors.prices ? 1 : 0}
              >
                <ItemPricesSection
                  control={control as unknown as Control<PricesFormValues>}
                  errors={errors}
                />
              </FormSection>
            )}
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

function pickDefaultUnit(uomOptions: UomOption[]): UomOption | undefined {
  return (
    uomOptions.find((u) => u.code.toUpperCase() === 'PCS') ??
    uomOptions.find((u) => u.isBaseUnit) ??
    uomOptions[0]
  )
}
