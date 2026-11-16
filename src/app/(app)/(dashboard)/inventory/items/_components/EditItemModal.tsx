'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller, useWatch, type Control } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import { CONTROL_CHROME, MONO, PLEX } from '@/src/libs/design/plex'
import { errorClass, inputClass, labelClass } from './itemFormChrome'
import { CategorySubgroupFields } from './item-create-fields'
import { quickAddAction, useQuickAddClassification } from './useQuickAddClassification'
import {
  UpdateItemFormSchema,
  UpdateItemFormValues,
  UomOption,
  ItemSummary,
  ClassificationOption,
} from '@/src/schema/inventory/items'
import type { ApiResponse } from '@/src/libs/api/client'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { getAttributes } from '../../attributes/_actions/get-attributes'
import { getItemAttributes } from '../_actions/get-item-attributes'
import type { AttributeDefinition } from '@/src/schema/inventory/attributes'
import { NumericInput, FormSection } from './item-form-shared'
import ItemPricesSection, { type PricesFormValues } from './ItemPricesSection'
import { getItemPriceGuide } from '../_actions/get-item-price-guide'
import { setItemPrices } from '../_actions/set-item-prices'
import {
  changedPriceEntries,
  fromPriceGuideEntry,
  toItemPricePayload,
  type ItemPriceEntry,
} from '@/src/schema/inventory/items/item-prices'
import { showToast } from '@/src/components/ui/toast'
import { useMe } from '@/src/hooks/useMe'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { formatClassificationLabel } from '@/src/libs/format/text'

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
  item: ItemSummary | null
  onClose: () => void
  onSubmit: (data: UpdateItemFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  categories: CategorySelectOption[]
  uomOptions: UomOption[]
  onAttributeSubmit: (attributes: Record<string, string>) => Promise<ApiResponse<unknown>>
  isAttributeSubmitting: boolean
  canReadAttributes?: boolean
  brandOptions: ClassificationOption[]
  typeOptions: ClassificationOption[]
}

export default function EditItemModal({
  isOpen,
  item,
  onClose,
  onSubmit,
  isSubmitting,
  categories,
  onAttributeSubmit,
  isAttributeSubmitting,
  canReadAttributes = true,
  brandOptions,
  typeOptions,
}: Props) {
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})
  const [confirmingClose, setConfirmingClose] = useState(false)
  const { data: me } = useMe()
  const canSetPrices = hasPermission(me ?? null, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    setFocus,
    formState: { errors, isDirty, submitCount },
  } = useForm<UpdateItemFormValues>({
    resolver: zodResolver(UpdateItemFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      primaryCategoryId: '',
      baseUnitId: '',
      costPrice: undefined,
      sellingPrice: undefined,
      costingMethod: 'weighted_average',
      isBatchTracked: false,
      isSerialTracked: false,
      requiresSecondarySerial: false,
      isExpiryTracked: false,
      isBundle: false,
      isService: false,
      brandId: undefined,
      typeId: '',
      modelNumber: '',
      prices: [],
    },
  })

  useEffect(() => {
    if (item && isOpen) {
      reset({
        name: item.name,
        sku: item.sku,
        primaryCategoryId: item.primaryCategory?.id ?? undefined,
        baseUnitId: item.baseUnit?.id ?? undefined,
        costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
        sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : undefined,
        costingMethod: 'weighted_average',
        isBatchTracked: item.isBatchTracked ?? false,
        isSerialTracked: item.isSerialTracked ?? false,
        requiresSecondarySerial: item.requiresSecondarySerial ?? false,
        isExpiryTracked: item.isExpiryTracked ?? false,
        isBundle: item.isBundle ?? false,
        isService: item.isService ?? false,
        brandId: item.brand?.id ?? undefined,
        typeId: item.type?.id ?? '',
        modelNumber: item.modelNumber ?? '',
        prices: [],
      })
    } else if (!isOpen) {
      reset()
    }
    // Depend on item.id and isOpen only — not the whole item object — so a
    // parent re-render that produces a new item reference doesn't reset the form
    // while the user is mid-edit.
  }, [item?.id, isOpen, reset])

  const selectedCategoryId = useWatch({ control, name: 'primaryCategoryId' })
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

  // Service items never carry stock/serial tracking — force-clear + disable those
  // checkboxes whenever "Service Item" is checked.
  const isServiceValue = useWatch({ control, name: 'isService' })
  useEffect(() => {
    if (!isServiceValue) return
    TRACKING_FIELDS_DISABLED_BY_SERVICE.forEach((name) => setValue(name, false))
  }, [isServiceValue, setValue])

  const { data: attrDefsData } = useQuery({
    queryKey: ['inventory-attribute-definitions', selectedCategoryId],
    queryFn: () => getAttributes({ categoryId: selectedCategoryId, limit: 100 }),
    enabled: isOpen && !!selectedCategoryId && canReadAttributes,
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
    }
  }, [isOpen])

  // The item's current prices, one entry per price use — the Add Item price
  // section prefilled. Kept as the baseline so only edits get saved.
  const { data: priceGuide } = useQuery({
    queryKey: ['inventory-item-price-guide', item?.id],
    queryFn: () => getItemPriceGuide(item!.id),
    enabled: isOpen && !!item?.id && canSetPrices,
    staleTime: 30 * 1000,
  })
  const originalPrices: ItemPriceEntry[] = (priceGuide?.data ?? []).map(fromPriceGuideEntry)

  useEffect(() => {
    if (!isOpen || !priceGuide?.data) return
    // reset (not resetField) so useFieldArray picks up the rows; dirty fields
    // the user already touched are kept.
    reset(
      { ...getValues(), prices: priceGuide.data.map(fromPriceGuideEntry) },
      { keepDirtyValues: true }
    )
  }, [isOpen, priceGuide, reset, getValues])

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

  async function handleFormSubmit({ prices, ...data }: UpdateItemFormValues) {
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
    if (item && canSetPrices) await savePrices(item.id, prices ?? [])
    onClose()
  }

  /** Only new or changed price uses are sent; a failure keeps the item edits
   * and says what didn't stick. */
  async function savePrices(itemId: string, prices: ItemPriceEntry[]): Promise<void> {
    const changed = changedPriceEntries(prices, originalPrices)
    if (changed.length === 0) return
    const res = await setItemPrices(itemId, changed.map(toItemPricePayload))
    if (!res.success || !res.data) {
      showToast({
        title: 'Item saved, but prices failed',
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
  const isSaving = isSubmitting || isAttributeSubmitting

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit Item"
      // Full-content page, same shell as Add New Item: fills the area beside
      // the sidebar (positioned against <main>), so it widens when the
      // sidebar is collapsed and the sidebar stays usable.
      className={`absolute inset-0 z-50 flex flex-col bg-[#f2f2f3] ${PLEX}`}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-[#e4e4e9] bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`${MONO} mb-1 text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle`}>
              Inventory &rsaquo; Item Master &rsaquo; Edit item
            </p>
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#17171c]">
              Edit Item
            </h2>
            <p className="mt-1 truncate text-[13px] text-[#4b4b5a]">
              {item.name} <span className={`${MONO} text-ink-muted`}>· {item.sku}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Close"
            className="rounded-lg p-2 text-[#4b4b5a] hover:bg-[#f1f1f4]"
          >
            <X className="h-5 w-5" />
          </button>
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
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
            {/* Basic Info — same fields, order and rules as Add New Item */}
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
                      value={field.value ?? ''}
                      type="text"
                      placeholder="e.g. Kolin Airconditioner KFM36E0W"
                      className={inputClass}
                    />
                  )}
                />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
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
                      value={field.value ?? ''}
                      type="text"
                      placeholder="e.g. ITEM-0001"
                      className={`${inputClass} uppercase`}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  )}
                />
                {errors.sku && <p className={errorClass}>{errors.sku.message}</p>}
              </div>

              {/* Type */}
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
                      options={typeOptions.map((t) => ({
                        value: t.id,
                        label: formatClassificationLabel(t.name),
                      }))}
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
                  />
                )}
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
                      emptyAction={brandAction}
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
                      value={field.value ?? ''}
                      type="text"
                      placeholder="e.g. KFM36E0W"
                      className={inputClass}
                    />
                  )}
                />
                {errors.modelNumber && <p className={errorClass}>{errors.modelNumber.message}</p>}
              </div>
            </FormSection>

            {/* Pricing */}
            <FormSection
              variant="card"
              title="Cost"
              defaultOpen={true}
              errorCount={pricingErrors}
              forceOpen={hasSubmitErrors && pricingErrors > 0}
            >
              <div>
                <label className={labelClass}>Cost Price (₱)</label>
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

            {/* Tracking — the same four options Add New Item offers */}
            <FormSection variant="card" title="Tracking" defaultOpen={true}>
              <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    { name: 'isSerialTracked', label: 'Serial Tracking' },
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

            {canSetPrices && (
              <FormSection
                variant="card"
                title="Prices (Optional)"
                defaultOpen={true}
                errorCount={errors.prices ? 1 : 0}
                forceOpen={hasSubmitErrors && !!errors.prices}
              >
                <ItemPricesSection
                  control={control as unknown as Control<PricesFormValues>}
                  errors={errors}
                />
              </FormSection>
            )}

            {/* Custom Attributes — only rendered when attrDefs are present */}
            {attrDefs.length > 0 && (
              <FormSection variant="card" title="Custom Attributes" defaultOpen={true}>
                {attrDefs.map((def) => (
                  <div key={def.id}>
                    <label className={labelClass}>
                      {def.displayName}
                      {def.isRequired && <span className="ml-1 text-[#b42318]">*</span>}
                    </label>
                    <AttributeInput
                      def={def}
                      value={attrValues[def.attributeKey]}
                      onChange={(v) =>
                        setAttrValues((prev) => ({ ...prev, [def.attributeKey]: v }))
                      }
                    />
                  </div>
                ))}
              </FormSection>
            )}
          </div>
        </div>

        {/* Sticky footer — same bar as Add New Item */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#e4e4e9] bg-white px-6 py-3.5">
          <span className="hidden text-[12px] text-[#4b4b5a] sm:block">
            Required fields are marked <span className="text-[#b42318]">*</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isSaving}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#4b4b5a] hover:bg-[#f1f1f4] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

const CHECKBOX = 'h-4 w-4 accent-[#5b21b6]'

/** One custom attribute's input, by its data type. */
function AttributeInput({
  def,
  value,
  onChange,
}: {
  def: AttributeDefinition
  value: string | undefined
  onChange: (value: string) => void
}): React.JSX.Element {
  if (def.dataType === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={value === 'true'}
        onChange={(e) => onChange(String(e.target.checked))}
        className={CHECKBOX}
      />
    )
  }
  if (def.dataType === 'dropdown' && def.options?.length) {
    return (
      <SearchableSelect
        chrome={CONTROL_CHROME}
        portal
        value={value ?? ''}
        onChange={onChange}
        options={def.options.map((opt) => ({ value: opt, label: opt }))}
        placeholder="Select…"
        clearable={!def.isRequired}
      />
    )
  }
  if (def.dataType === 'multi_select' && def.options?.length) {
    return <MultiSelectInput options={def.options} value={value} onChange={onChange} />
  }
  const type = def.dataType === 'number' ? 'number' : def.dataType === 'date' ? 'date' : 'text'
  return (
    <input
      type={type}
      value={value ?? def.defaultValue ?? ''}
      placeholder={def.defaultValue ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  )
}

/** A multi-select attribute, stored comma-joined. */
function MultiSelectInput({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string | undefined
  onChange: (value: string) => void
}): React.JSX.Element {
  const selected = (value ?? '').split(',').filter(Boolean)
  return (
    <div className="space-y-1">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-[13px] text-[#3d3d4a]">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={(e) =>
              onChange(
                (e.target.checked ? [...selected, opt] : selected.filter((v) => v !== opt)).join(
                  ','
                )
              )
            }
            className={CHECKBOX}
          />
          {opt}
        </label>
      ))}
    </div>
  )
}
