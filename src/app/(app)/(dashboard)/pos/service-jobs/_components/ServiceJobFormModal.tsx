'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import {
  CreateServiceDraftFormSchema,
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATALOG,
  AUTO_SUGGEST_MATERIAL_CATEGORIES,
  type CreateServiceDraftFormValues,
  type ServiceCategory,
  type ServiceDraft,
} from '@/src/schema/pos/service-drafts'
import { MaterialItemSearchCombobox, type MaterialItemMeta } from './MaterialItemSearchCombobox'
import { SerialNumberSearchCombobox } from './SerialNumberSearchCombobox'
import { CustomerSearchCombobox } from './CustomerSearchCombobox'
import { TransactionSearchCombobox } from './TransactionSearchCombobox'
import { NumericInput } from '@/src/app/(app)/(dashboard)/inventory/items/_components/item-form-shared'
import { BranchSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/BranchSearchCombobox'
import { Select } from '@/src/components/ui/Select'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import { customerDisplayName } from './service-draft-utils'

const SERVICE_CATEGORY_OPTIONS = Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

type LockedBranch = { id: string; name: string } | null

type Props = {
  open: boolean
  onClose: () => void
  onCreate?: (data: CreateServiceDraftFormValues) => Promise<void>
  isCreating?: boolean
  lockedBranch: LockedBranch
  draft?: ServiceDraft | null
  onUpdate?: (id: string, data: CreateServiceDraftFormValues) => Promise<void>
  isSaving?: boolean
}

// Computes the form's default values for either create mode (no draft) or
// edit mode (draft provided) — mirrors CreatePurchaseRequestModal's
// getDefaultValues helper. When lockedBranch is set (branch-scoped actor),
// the branch is always pinned to it — the backend force-overrides branchId
// for these actors regardless of what's submitted, so the UI shouldn't imply
// the job could target any other branch.
function getDefaultValues(
  draft: ServiceDraft | null | undefined,
  lockedBranch: LockedBranch
): CreateServiceDraftFormValues {
  if (draft) {
    return {
      branchId: lockedBranch ? lockedBranch.id : (draft.branchId ?? undefined),
      title: draft.title,
      customerId: draft.customerId ?? undefined,
      posTransactionId: draft.posTransactionId ?? undefined,
      notes: draft.notes ?? '',
      lines: draft.lines.map((line) => ({
        itemId: line.itemId,
        estimatedQty: Number(line.estimatedQty),
        notes: line.notes ?? '',
        serialNumberId: line.serialNumberId ?? undefined,
      })),
      // A job created before Closing Gap 6 existed has none on record —
      // deliberately NOT defaulted to a placeholder row here, so opening an
      // old job to tweak materials doesn't force adding a service type
      // just to save.
      serviceTypes: (draft.serviceTypes ?? []).map((st) => ({
        category: st.category,
        subType: st.subType,
        quotedAmount: Number(st.quotedAmount),
      })),
    }
  }

  return {
    branchId: lockedBranch ? lockedBranch.id : undefined,
    title: '',
    customerId: undefined,
    posTransactionId: undefined,
    notes: '',
    lines: [
      {
        itemId: '',
        estimatedQty: 1,
        notes: '',
        serialNumberId: undefined,
      },
    ],
    // Deliberately empty, NOT pre-added like Estimated Materials' one
    // default line — a pre-added row's own category/subType/quotedAmount
    // are each individually required once present, so defaulting to one
    // empty row would silently block submission on every job that doesn't
    // touch this section (found live: broke every pre-existing
    // service-draft e2e spec, none of which know about this new section).
    // "Add Service Type" is the only way a row appears now.
    serviceTypes: [],
  }
}

export function ServiceJobFormModal({
  open,
  onClose,
  onCreate,
  isCreating,
  lockedBranch,
  draft,
  onUpdate,
  isSaving,
}: Props) {
  const isEditMode = !!draft
  const isBusy = isEditMode ? isSaving : isCreating
  // The backend only accepts a PATCH while the draft is still 'draft' — if a
  // stale reference gets here after the status moved on, refuse to render an
  // editable form rather than let the user hit a confusing 400.
  const isLocked = isEditMode && draft.status !== 'draft'

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateServiceDraftFormValues>({
    resolver: zodResolver(CreateServiceDraftFormSchema),
    defaultValues: getDefaultValues(draft, lockedBranch),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  const {
    fields: serviceTypeFields,
    append: appendServiceType,
    remove: removeServiceType,
  } = useFieldArray({
    control,
    name: 'serviceTypes',
  })

  // Label shown for a materials line the auto-suggestion (below) just
  // appended, keyed by that line's index — MaterialItemSearchCombobox only
  // reads `initialLabel` once, on mount, so this only matters for a line
  // that didn't exist a render ago (a fresh field.id from append() is a
  // fresh mount either way).
  const [suggestedMaterialLabels, setSuggestedMaterialLabels] = useState<Record<number, string>>({})

  // Whether each line's picked material is serial-tracked — not part of the
  // RHF/zod schema (derived from the item, not user input directly), drives
  // whether that line shows a serial-number field and locks estimatedQty to
  // 1. Keyed by array index rather than useFieldArray's field.id: seeding
  // this from the draft on edit-mode load needs to happen before `fields`
  // exists for the reset'd values, so field.id isn't available yet either
  // way — index is simpler and is kept in sync on add/remove below.
  const [serialTracked, setSerialTracked] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (open && draft) {
      reset(getDefaultValues(draft, lockedBranch))
      setSerialTracked(
        Object.fromEntries(draft.lines.map((line, i) => [i, !!line.item?.isSerialTracked]))
      )
      setSuggestedMaterialLabels({})
    } else if (!open) {
      reset(getDefaultValues(null, lockedBranch))
      setSerialTracked({})
      setSuggestedMaterialLabels({})
    }
  }, [open, draft, lockedBranch, reset])

  function handleMaterialSelect(index: number, meta: MaterialItemMeta | undefined) {
    const isSerial = !!meta?.isSerialTracked
    setSerialTracked((prev) => ({ ...prev, [index]: isSerial }))
    setValue(`lines.${index}.serialNumberId`, undefined)
    clearErrors(`lines.${index}.serialNumberId`)
    if (isSerial) setValue(`lines.${index}.estimatedQty`, 1)
  }

  function handleAddLine() {
    append({ itemId: '', estimatedQty: 1, notes: '', serialNumberId: undefined })
  }

  function handleAddServiceType() {
    appendServiceType({ category: '', subType: '', quotedAmount: 0 })
  }

  function handleRemoveServiceType(index: number) {
    removeServiceType(index)
  }

  function handleServiceCategoryChange(index: number, category: string) {
    setValue(`serviceTypes.${index}.category`, category)
    // The previously-picked subType may not belong to the new category —
    // clear it rather than silently leaving a now-invalid combination.
    setValue(`serviceTypes.${index}.subType`, '')
  }

  // Materials auto-suggestion (Closing Gap 6, confirmed in scope): picking a
  // sub-type under either "Replacement of ... Electrical Part(s)" category
  // is literally named after a physical part, so pre-fill a matching
  // Estimated Materials line for that same-named item. Only fires when a
  // real, unambiguous, not-already-added match exists — the cashier can
  // still adjust or remove the suggested line either way.
  async function maybeSuggestMaterial(category: string, subType: string) {
    if (!AUTO_SUGGEST_MATERIAL_CATEGORIES.includes(category as ServiceCategory)) return

    const res = await getItems({ search: subType, limit: 5, lifecycle: 'active' })
    const candidates = (res.data?.data ?? []).filter((item) => item.isService !== true)
    const match = candidates.find((item) => item.name.toLowerCase() === subType.toLowerCase())
    if (!match) return

    const currentLines = watch('lines')
    const alreadyLinked = currentLines.some((line) => line.itemId === match.id)
    if (alreadyLinked) return

    const newIndex = currentLines.length
    append({ itemId: match.id, estimatedQty: 1, notes: '', serialNumberId: undefined })
    setSuggestedMaterialLabels((prev) => ({ ...prev, [newIndex]: match.name }))
    handleMaterialSelect(newIndex, { isSerialTracked: !!match.isSerialTracked })
  }

  function handleServiceSubTypeChange(index: number, category: string, subType: string) {
    setValue(`serviceTypes.${index}.subType`, subType)
    void maybeSuggestMaterial(category, subType)
  }

  function handleRemoveLine(index: number) {
    remove(index)
    setSerialTracked((prev) => {
      const next: Record<number, boolean> = {}
      Object.entries(prev).forEach(([key, val]) => {
        const i = Number(key)
        if (i < index) next[i] = val
        else if (i > index) next[i - 1] = val
      })
      return next
    })
    setSuggestedMaterialLabels((prev) => {
      const next: Record<number, string> = {}
      Object.entries(prev).forEach(([key, val]) => {
        const i = Number(key)
        if (i < index) next[i] = val
        else if (i > index) next[i - 1] = val
      })
      return next
    })
  }

  const watchedBranchId = watch('branchId')
  const effectiveBranchId = lockedBranch ? lockedBranch.id : watchedBranchId

  async function handleFormSubmit(data: CreateServiceDraftFormValues) {
    let hasSerialError = false
    data.lines.forEach((line, index) => {
      if (serialTracked[index] && !line.serialNumberId) {
        setError(`lines.${index}.serialNumberId`, {
          message: 'Select a serial number for this serial-tracked material',
        })
        hasSerialError = true
      }
    })
    if (hasSerialError) return

    if (draft) {
      await onUpdate?.(draft.id, data)
    } else {
      await onCreate?.(data)
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                {isEditMode ? 'Edit Service Job' : 'New Service Job'}
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                {isEditMode
                  ? 'Update the estimated materials below'
                  : 'Estimate the materials needed for this install job'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLocked ? (
          <div className="px-6 py-8">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  This job can no longer be edited
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  It has moved to &quot;{draft.status}&quot; status. Only jobs still in draft can
                  have their estimate changed.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
            <div className="px-6 py-4 space-y-4">
              {/* Branch */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Branch</label>
                {lockedBranch ? (
                  <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    {lockedBranch.name}
                  </div>
                ) : (
                  <Controller
                    name="branchId"
                    control={control}
                    render={({ field }) => (
                      <BranchSearchCombobox
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={errors.branchId?.message}
                        initialLabel={draft?.branch?.name}
                      />
                    )}
                  />
                )}
                {errors.branchId && (
                  <p className="mt-1 text-xs text-red-600">{errors.branchId.message}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. Aircon install — 1.5HP split-type"
                      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${errors.title ? 'border-red-400' : 'border-zinc-200'}`}
                    />
                  )}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Customer */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Customer</label>
                <Controller
                  name="customerId"
                  control={control}
                  render={({ field }) => (
                    <CustomerSearchCombobox
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      error={errors.customerId?.message}
                      initialLabel={
                        draft?.customer ? customerDisplayName(draft.customer) : undefined
                      }
                    />
                  )}
                />
              </div>

              {/* Linked Sale — the POS transaction/invoice this job's
                  aircon + install service was originally sold on, if any.
                  ServiceDraft.posTransactionId has existed since Closing Gap
                  2; this is the first UI to actually set or show it. */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Linked Sale</label>
                <Controller
                  name="posTransactionId"
                  control={control}
                  render={({ field }) => (
                    <TransactionSearchCombobox
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      error={errors.posTransactionId?.message}
                      initialLabel={draft?.posTransaction?.transactionNumber}
                    />
                  )}
                />
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
                      placeholder="Additional notes…"
                      className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  )}
                />
                {errors.notes && (
                  <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>
                )}
              </div>

              {/* Types of Service (Closing Gap 6) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">Types of Service</label>
                  <button
                    type="button"
                    onClick={handleAddServiceType}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                  >
                    <Plus className="h-3 w-3" />
                    Add Service Type
                  </button>
                </div>

                {serviceTypeFields.length === 0 && (
                  <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-2.5 text-xs text-zinc-400">
                    No service type added yet — optional, but helps categorize this job against
                    NIG&apos;s service catalog.
                  </p>
                )}

                <div className="space-y-3">
                  {serviceTypeFields.map((field, index) => {
                    const watchedCategory = watch(`serviceTypes.${index}.category`)
                    const subTypeOptions = watchedCategory
                      ? (SERVICE_CATALOG[watchedCategory as ServiceCategory] ?? []).map((s) => ({
                          value: s,
                          label: s,
                        }))
                      : []
                    return (
                      <div
                        key={field.id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                            Service {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveServiceType(index)}
                            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-zinc-600">
                              Category <span className="text-red-500">*</span>
                            </label>
                            <Controller
                              name={`serviceTypes.${index}.category`}
                              control={control}
                              render={({ field: f }) => (
                                <Select
                                  value={f.value ?? ''}
                                  onChange={(v) => handleServiceCategoryChange(index, v)}
                                  options={SERVICE_CATEGORY_OPTIONS}
                                  placeholder="Select category…"
                                />
                              )}
                            />
                            {errors.serviceTypes?.[index]?.category && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors.serviceTypes[index]?.category?.message}
                              </p>
                            )}
                          </div>

                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-zinc-600">
                              Sub-type <span className="text-red-500">*</span>
                            </label>
                            <Controller
                              name={`serviceTypes.${index}.subType`}
                              control={control}
                              render={({ field: f }) => (
                                <Select
                                  value={f.value ?? ''}
                                  onChange={(v) =>
                                    handleServiceSubTypeChange(index, watchedCategory ?? '', v)
                                  }
                                  options={subTypeOptions}
                                  placeholder={
                                    watchedCategory ? 'Select sub-type…' : 'Pick a category first'
                                  }
                                />
                              )}
                            />
                            {errors.serviceTypes?.[index]?.subType && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors.serviceTypes[index]?.subType?.message}
                              </p>
                            )}
                          </div>

                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-zinc-600">
                              Quoted Amount <span className="text-red-500">*</span>
                            </label>
                            <Controller
                              name={`serviceTypes.${index}.quotedAmount`}
                              control={control}
                              render={({ field: f }) => (
                                <NumericInput
                                  value={f.value}
                                  onChange={(v) => f.onChange(v ?? 0)}
                                  onBlur={f.onBlur}
                                  // Deliberately not "0.00" — the Estimated
                                  // Materials section's Qty field already
                                  // uses placeholder="0", and Playwright's
                                  // getByPlaceholder('0') substring-matches
                                  // "0.00" too, breaking every existing
                                  // service-draft e2e spec that fills Qty.
                                  placeholder="Amount"
                                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${errors.serviceTypes?.[index]?.quotedAmount ? 'border-red-400' : 'border-zinc-200'}`}
                                />
                              )}
                            />
                            {errors.serviceTypes?.[index]?.quotedAmount && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors.serviceTypes[index]?.quotedAmount?.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Estimated Material Lines */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">
                    Estimated Materials <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                  >
                    <Plus className="h-3 w-3" />
                    Add Line
                  </button>
                </div>

                {errors.lines && !Array.isArray(errors.lines) && (
                  <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
                )}

                <div className="space-y-3">
                  {fields.map((field, index) => {
                    // useFieldArray's `field` only carries the value it had
                    // at the last append/remove/reset — it does not live-
                    // update when a sibling Controller's onChange fires for
                    // this same array item, so the serial picker below needs
                    // watch() for the current itemId, not field.itemId.
                    const currentItemId = watch(`lines.${index}.itemId`)
                    return (
                      <div
                        key={field.id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                            Line {index + 1}
                          </span>
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(index)}
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Material Item Search */}
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-zinc-600">
                              Material <span className="text-red-500">*</span>
                            </label>
                            <Controller
                              name={`lines.${index}.itemId`}
                              control={control}
                              render={({ field: f }) => (
                                <MaterialItemSearchCombobox
                                  value={f.value}
                                  onChange={f.onChange}
                                  onSelectItem={(meta) => handleMaterialSelect(index, meta)}
                                  error={errors.lines?.[index]?.itemId?.message}
                                  initialLabel={
                                    draft?.lines[index]?.item?.name ??
                                    suggestedMaterialLabels[index]
                                  }
                                />
                              )}
                            />
                            {errors.lines?.[index]?.itemId && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors.lines[index]?.itemId?.message}
                              </p>
                            )}
                          </div>

                          {/* Serial Number — only for a serial-tracked material;
                            identifies one physical unit, so estimatedQty is
                            locked to 1 alongside it. */}
                          {serialTracked[index] && (
                            <div className="col-span-2">
                              <label className="mb-1 block text-xs font-medium text-zinc-600">
                                Serial Number <span className="text-red-500">*</span>
                              </label>
                              <Controller
                                name={`lines.${index}.serialNumberId`}
                                control={control}
                                render={({ field: f }) => (
                                  <SerialNumberSearchCombobox
                                    key={`serial-${index}-${currentItemId}`}
                                    itemId={currentItemId ?? ''}
                                    branchId={effectiveBranchId}
                                    value={f.value ?? ''}
                                    onChange={f.onChange}
                                    error={errors.lines?.[index]?.serialNumberId?.message}
                                    initialLabel={draft?.lines[index]?.serialNumber?.serialNumber}
                                  />
                                )}
                              />
                              {errors.lines?.[index]?.serialNumberId && (
                                <p className="mt-1 text-xs text-red-500">
                                  {errors.lines[index]?.serialNumberId?.message}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Estimated Quantity */}
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600">
                              Estimated Qty <span className="text-red-500">*</span>
                            </label>
                            <Controller
                              name={`lines.${index}.estimatedQty`}
                              control={control}
                              render={({ field: f }) =>
                                serialTracked[index] ? (
                                  <input
                                    type="text"
                                    value="1"
                                    disabled
                                    className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500"
                                  />
                                ) : (
                                  <NumericInput
                                    value={f.value}
                                    onChange={(v) => f.onChange(v ?? 0)}
                                    onBlur={f.onBlur}
                                    placeholder="0"
                                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${errors.lines?.[index]?.estimatedQty ? 'border-red-400' : 'border-zinc-200'}`}
                                  />
                                )
                              }
                            />
                            {errors.lines?.[index]?.estimatedQty && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors.lines[index]?.estimatedQty?.message}
                              </p>
                            )}
                          </div>

                          {/* Line Notes */}
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600">
                              Line Notes
                            </label>
                            <Controller
                              name={`lines.${index}.notes`}
                              control={control}
                              render={({ field: f }) => (
                                <input
                                  {...f}
                                  value={f.value ?? ''}
                                  type="text"
                                  placeholder="Optional notes"
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditMode
                  ? isBusy
                    ? 'Saving…'
                    : 'Save Changes'
                  : isBusy
                    ? 'Creating…'
                    : 'Create Service Job'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
