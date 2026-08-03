'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  PriceListFormSchema,
  type PriceListFormValues,
  type PriceList,
} from '@/src/schema/inventory/price-lists'
import type { ApiResponse } from '@/src/libs/api/client'
import type { Currency } from '../_actions/get-currencies'
import type { Branch } from '../_actions/get-branches'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PriceListFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  currencies: Currency[]
  branches: Branch[]
  initial?: PriceList
  supersedesFrom?: PriceList
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const EMPTY_VALUES: PriceListFormValues = {
  name: '',
  listType: 'retail',
  description: '',
  currency: 'PHP',
  effectiveFrom: undefined,
  effectiveTo: undefined,
  priority: 0,
  allowedBranchIds: [],
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

function toFormValues(list?: PriceList, supersedesFrom?: PriceList): PriceListFormValues {
  const source = list ?? supersedesFrom
  if (!source) return EMPTY_VALUES
  return {
    name: list ? source.name : `${source.name} (new version)`,
    listType: source.listType,
    description: source.description ?? '',
    currency: source.currency,
    effectiveFrom: source.effectiveFrom?.slice(0, 10),
    effectiveTo: source.effectiveTo?.slice(0, 10),
    priority: source.priority,
    allowedBranchIds: source.allowedBranchIds ?? [],
    supersedesId: list ? undefined : supersedesFrom?.id,
  }
}

export default function PriceListModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  currencies,
  branches,
  initial,
  supersedesFrom,
}: Props) {
  const isEdit = Boolean(initial)
  const isNewVersion = !isEdit && Boolean(supersedesFrom)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceListFormValues>({
    resolver: zodResolver(PriceListFormSchema),
    defaultValues: toFormValues(initial, supersedesFrom),
  })

  useEffect(() => {
    reset(isOpen ? toFormValues(initial, supersedesFrom) : EMPTY_VALUES)
  }, [isOpen, initial, supersedesFrom, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: PriceListFormValues) {
    const result = await onSubmit({
      ...data,
      effectiveFrom: data.effectiveFrom || undefined,
      effectiveTo: data.effectiveTo || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? 'Edit Price List' : isNewVersion ? 'New Version' : 'New Price List'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit
                ? 'Update this pricing tier.'
                : isNewVersion
                  ? 'Create a new version to replace an active list.'
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
            {isNewVersion && supersedesFrom && (
              <div className="rounded-lg border border-prominent-purple-200 bg-prominent-purple-50 px-4 py-2 text-xs text-prominent-purple-800">
                This will supersede <strong>{supersedesFrom.name}</strong> once approved — that
                version will auto-expire.
              </div>
            )}

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
                  List Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="listType"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="member">Member</option>
                      <option value="promotional">Promotional</option>
                      <option value="custom">Custom</option>
                    </select>
                  )}
                />
                {errors.listType && (
                  <p className="mt-1 text-xs text-red-600">{errors.listType.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Currency</label>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select currency…</option>
                      {currencies.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code} – {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.currency && (
                  <p className="mt-1 text-xs text-red-600">{errors.currency.message}</p>
                )}
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">Priority</label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      step="1"
                      placeholder="0"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                      }
                    />
                  )}
                />
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
              {isSubmitting
                ? 'Saving…'
                : isEdit
                  ? 'Save Changes'
                  : isNewVersion
                    ? 'Create New Version'
                    : 'Create Price List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
