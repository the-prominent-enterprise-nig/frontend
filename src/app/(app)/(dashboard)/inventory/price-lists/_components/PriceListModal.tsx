'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  PriceListFormSchema,
  type PriceListFormValues,
  type PriceList,
} from '@/src/schema/inventory/price-lists'
import {
  PriceUseTypeSchema,
  type PriceUseType,
  type PriceUseTypeFormValues,
} from '@/src/schema/inventory/price-use-types'
import type { ApiResponse } from '@/src/libs/api/client'
import { Select } from '@/src/components/ui/Select'
import type { Branch } from '../_actions/get-branches'
import PriceUseTypeModal from '../../price-use-types/_components/PriceUseTypeModal'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PriceListFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  branches: Branch[]
  priceUseTypes: PriceUseType[]
  /** Scenario 15, Part 4 — every other price list, used to populate the
   * "Supersedes" picker (filtered to the currently-selected Price Use
   * Type, excluding this list itself when editing). */
  priceLists: PriceList[]
  onCreatePriceUseType: (data: PriceUseTypeFormValues) => Promise<ApiResponse<unknown>>
  isCreatingPriceUseType: boolean
  initial?: PriceList
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const EMPTY_VALUES: PriceListFormValues = {
  name: '',
  priceUseTypeId: '',
  description: '',
  currency: 'PHP',
  effectiveFrom: '',
  effectiveTo: '',
  priority: 0,
  allowedBranchIds: [],
  supersedesId: '',
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  inactive: 'Inactive',
  expired: 'Expired',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  inactive: 'bg-zinc-100 text-zinc-500',
  expired: 'bg-zinc-100 text-zinc-500',
}

function toFormValues(list?: PriceList): PriceListFormValues {
  if (!list) return EMPTY_VALUES
  return {
    name: list.name,
    priceUseTypeId: list.priceUseTypeId,
    description: list.description ?? '',
    currency: list.currency,
    // A date <input> must never see `value=undefined` after mounting with a
    // real value (or vice versa) — that's what flips it from uncontrolled to
    // controlled and trips React's warning. '' is the "no date" sentinel for
    // the whole form; handleFormSubmit converts it back to undefined for the API.
    effectiveFrom: list.effectiveFrom?.slice(0, 10) ?? '',
    effectiveTo: list.effectiveTo?.slice(0, 10) ?? '',
    priority: list.priority,
    allowedBranchIds: list.allowedBranchIds ?? [],
    supersedesId: list.supersedesId ?? '',
  }
}

export default function PriceListModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  branches,
  priceUseTypes,
  priceLists,
  onCreatePriceUseType,
  isCreatingPriceUseType,
  initial,
}: Props) {
  const isEdit = Boolean(initial)
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false)
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PriceListFormValues>({
    resolver: zodResolver(PriceListFormSchema),
    defaultValues: toFormValues(initial),
  })
  // Only offer lists under the same Price Use Type as candidates to
  // supersede — cross-type supersession isn't blocked server-side, but it's
  // never what an admin actually means by "new version of this list".
  const selectedPriceUseTypeId = watch('priceUseTypeId')
  const supersedeCandidates = priceLists.filter(
    (pl) => pl.priceUseTypeId === selectedPriceUseTypeId && pl.id !== initial?.id
  )
  // Mirrors the Priority field's raw typed text — kept separate from the
  // committed number so the input can sit visually empty mid-edit (e.g.
  // clearing "0" to type "25") instead of a forced field.onChange(0)
  // re-rendering a literal "0" back into the DOM ahead of the next keystroke.
  const [priorityText, setPriorityText] = useState(String(EMPTY_VALUES.priority))

  useEffect(() => {
    const values = isOpen ? toFormValues(initial) : EMPTY_VALUES
    reset(values)
    setPriorityText(String(values.priority))
  }, [isOpen, initial, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: PriceListFormValues) {
    // Guard against a stale supersedesId left over from before the Price
    // Use Type was changed mid-edit — only ever submit it when it's still
    // one of the currently-valid (same-type, non-self) candidates.
    const supersedesId = supersedeCandidates.some((pl) => pl.id === data.supersedesId)
      ? data.supersedesId
      : undefined
    const result = await onSubmit({
      ...data,
      effectiveFrom: data.effectiveFrom || undefined,
      effectiveTo: data.effectiveTo || undefined,
      supersedesId,
    })
    if (result.success) onClose()
  }

  async function handleCreateType(data: PriceUseTypeFormValues) {
    const result = await onCreatePriceUseType(data)
    if (result.success) {
      const parsed = PriceUseTypeSchema.safeParse(result.data)
      if (parsed.success) {
        setValue('priceUseTypeId', parsed.data.id, { shouldValidate: true })
      }
      setIsCreateTypeOpen(false)
    }
    return result
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? 'Edit Price List' : 'New Price List'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit
                ? 'Update this pricing tier.'
                : 'Create a new pricing tier for your inventory items.'}
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
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Retail Standard 2026"
                    className={fieldClass}
                  />
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Price Use Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="priceUseTypeId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select price use type…"
                      options={priceUseTypes.map((t) => ({ value: t.id, label: t.name }))}
                      extraAction={{
                        label: 'Add new price use type…',
                        onClick: () => setIsCreateTypeOpen(true),
                      }}
                    />
                  )}
                />
                {errors.priceUseTypeId && (
                  <p className="mt-1 text-xs text-red-600">{errors.priceUseTypeId.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Currency</label>
                <div className={`${fieldClass} bg-zinc-50 text-zinc-500`}>
                  Philippine Peso (PHP)
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Description{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Brief description of this price list…"
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Effective From{' '}
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="effectiveFrom"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Effective To{' '}
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="effectiveTo"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Priority{' '}
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    (higher wins conflicts)
                  </span>
                </label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <input
                      ref={field.ref}
                      name={field.name}
                      type="number"
                      step="1"
                      placeholder="0"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      value={priorityText}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value
                        setPriorityText(raw)
                        field.onChange(raw === '' ? 0 : Number(raw))
                      }}
                      onBlur={() => {
                        field.onBlur()
                        if (priorityText === '') setPriorityText('0')
                      }}
                    />
                  )}
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Only matters if this could clash with another price list on the same sale — the
                  higher number wins. Leave at 0 if you&apos;re not sure.
                </p>
                {errors.priority && (
                  <p className="mt-1 text-xs text-red-600">{errors.priority.message}</p>
                )}
              </div>
              {isEdit && initial && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[initial.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                  >
                    {STATUS_LABELS[initial.status] ?? initial.status}
                  </span>
                  <p className="mt-1 text-xs text-zinc-400">
                    Set by the approval workflow, not editable here.
                  </p>
                </div>
              )}
            </div>

            {isEdit && initial?.status === 'rejected' && initial.remarks && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs font-medium text-red-800">Rejection reason</p>
                <p className="mt-0.5 text-sm text-red-700">{initial.remarks}</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Branches{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  (leave all unchecked for company-wide)
                </span>
              </label>
              <Controller
                name="allowedBranchIds"
                control={control}
                render={({ field }) => (
                  <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-3">
                    {branches.length === 0 && (
                      <p className="text-xs text-zinc-400">No branches found.</p>
                    )}
                    {branches.map((branch) => {
                      const selected = field.value ?? []
                      const checked = selected.includes(branch.id)
                      return (
                        <label
                          key={branch.id}
                          className="flex items-center gap-2 text-sm text-zinc-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              field.onChange(
                                e.target.checked
                                  ? [...selected, branch.id]
                                  : selected.filter((id) => id !== branch.id)
                              )
                            }
                          />
                          {branch.name}
                        </label>
                      )
                    })}
                  </div>
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Supersedes{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  (optional — the prior version this replaces)
                </span>
              </label>
              <Controller
                name="supersedesId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={
                      selectedPriceUseTypeId
                        ? 'None — this is a new list, not a replacement'
                        : 'Pick a Price Use Type first'
                    }
                    options={supersedeCandidates.map((pl) => ({
                      value: pl.id,
                      label: pl.name,
                    }))}
                  />
                )}
              />
              <p className="mt-1 text-xs text-zinc-400">
                On approval, the superseded list auto-expires. Only lists under the same Price Use
                Type are shown.
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
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Price List'}
            </button>
          </div>
        </form>
      </div>

      <PriceUseTypeModal
        isOpen={isCreateTypeOpen}
        onClose={() => setIsCreateTypeOpen(false)}
        onSubmit={handleCreateType}
        isSubmitting={isCreatingPriceUseType}
      />
    </div>
  )
}
