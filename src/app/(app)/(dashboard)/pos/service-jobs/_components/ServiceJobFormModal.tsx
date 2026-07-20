'use client'

import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import {
  CreateServiceDraftFormSchema,
  type CreateServiceDraftFormValues,
  type ServiceDraft,
} from '@/src/schema/pos/service-drafts'
import { MaterialItemSearchCombobox } from './MaterialItemSearchCombobox'
import { CustomerSearchCombobox } from './CustomerSearchCombobox'
import { NumericInput } from '@/src/app/(app)/(dashboard)/inventory/items/_components/item-form-shared'
import { BranchSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/BranchSearchCombobox'
import { customerDisplayName } from './service-draft-utils'

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
      },
    ],
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
    formState: { errors },
  } = useForm<CreateServiceDraftFormValues>({
    resolver: zodResolver(CreateServiceDraftFormSchema),
    defaultValues: getDefaultValues(draft, lockedBranch),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  useEffect(() => {
    if (open && draft) {
      reset(getDefaultValues(draft, lockedBranch))
    } else if (!open) {
      reset(getDefaultValues(null, lockedBranch))
    }
  }, [open, draft, lockedBranch, reset])

  async function handleFormSubmit(data: CreateServiceDraftFormValues) {
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

              {/* Estimated Material Lines */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">
                    Estimated Materials <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      append({
                        itemId: '',
                        estimatedQty: 1,
                        notes: '',
                      })
                    }
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
                  {fields.map((field, index) => (
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
                            onClick={() => remove(index)}
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
                                error={errors.lines?.[index]?.itemId?.message}
                                initialLabel={draft?.lines[index]?.item?.name}
                              />
                            )}
                          />
                          {errors.lines?.[index]?.itemId && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.lines[index]?.itemId?.message}
                            </p>
                          )}
                        </div>

                        {/* Estimated Quantity */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600">
                            Estimated Qty <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name={`lines.${index}.estimatedQty`}
                            control={control}
                            render={({ field: f }) => (
                              <NumericInput
                                value={f.value}
                                onChange={(v) => f.onChange(v ?? 0)}
                                onBlur={f.onBlur}
                                placeholder="0"
                                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${errors.lines?.[index]?.estimatedQty ? 'border-red-400' : 'border-zinc-200'}`}
                              />
                            )}
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
                  ))}
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
