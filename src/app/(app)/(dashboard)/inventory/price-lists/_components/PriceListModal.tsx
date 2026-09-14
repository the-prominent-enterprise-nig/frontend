'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Search, Check, Plus, AlertTriangle } from 'lucide-react'
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
import Drawer from '@/src/components/ui/drawer/Drawer'
import type { Branch } from '../_actions/get-branches'
import PriceUseTypeModal from '../../price-use-types/_components/PriceUseTypeModal'
import { PLEX, MONO } from '@/src/libs/design/plex'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PriceListFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  branches: Branch[]
  priceUseTypes: PriceUseType[]
  /** Scenario 15, Part 4 — every other price list, used to populate the
   * "Supersedes" picker (filtered to the currently-selected Price Use
   * Type, excluding this list itself when editing) and, since the redesign,
   * to warn about a clash with a list that is already live. */
  priceLists: PriceList[]
  /** Active catalog size, so Review can show how much is left to price. */
  catalogTotal: number
  onCreatePriceUseType: (data: PriceUseTypeFormValues) => Promise<ApiResponse<unknown>>
  isCreatingPriceUseType: boolean
  initial?: PriceList
}

const FORM_ID = 'price-list-form'

const fieldClass =
  'w-full rounded-lg border border-[#d3d3db] px-3 py-2 text-sm outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

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
  // Scenario 50 Gap 7 — the client's stated norm; matches the backend's own
  // default for a list created with this field omitted entirely.
  pricingMode: 'inclusive',
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  inactive: 'Inactive',
  expired: 'Expired',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending_approval: 'bg-[#fbeed8] text-[#8a4b06]',
  active: 'bg-[#d7ebe2] text-[#0b6644]',
  rejected: 'bg-[#fbdedb] text-[#b42318]',
  inactive: 'bg-[#f1f1f4] text-[#5b5b6b]',
  expired: 'bg-[#f1f1f4] text-[#5b5b6b]',
}

const REGION_LABELS: Record<string, string> = {
  negros: 'Negros',
  panay: 'Panay',
}

function regionLabel(region: string | null | undefined): string {
  return region ? (REGION_LABELS[region] ?? region) : 'Other'
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
    // Null (a list from before this field existed) defaults to inclusive in
    // the form the same way a brand-new list does — it's the declared norm,
    // not a per-list toggle most lists are expected to actually change.
    pricingMode: list.pricingMode ?? 'inclusive',
  }
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex gap-1 rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] p-1">
      {options.map((option) => {
        const isOn = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isOn}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isOn ? 'bg-[#5b21b6] text-white' : 'text-[#5b5b6b] hover:text-[#17171c]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default function PriceListModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  branches,
  priceUseTypes,
  priceLists,
  catalogTotal,
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
  const [branchSearch, setBranchSearch] = useState('')

  const name = watch('name')
  const effectiveFrom = watch('effectiveFrom')
  const effectiveTo = watch('effectiveTo')
  const allowedBranchIds = watch('allowedBranchIds') ?? []
  const supersedesId = watch('supersedesId')
  const pricingMode = watch('pricingMode')
  const priority = watch('priority')

  useEffect(() => {
    const values = isOpen ? toFormValues(initial) : EMPTY_VALUES
    reset(values)
    setPriorityText(String(values.priority))
    setBranchSearch('')
  }, [isOpen, initial, reset])

  // Two derived toggles the schema has no field for: "always on" is simply
  // both dates empty, and "company-wide" is an empty branch list. Modelling
  // them as explicit choices stops a half-filled date range or an empty
  // branch box from reading as a deliberate decision.
  const windowMode: 'always' | 'dated' = effectiveFrom || effectiveTo ? 'dated' : 'always'
  const [scopeMode, setScopeMode] = useState<'company' | 'branches'>('company')
  useEffect(() => {
    if (isOpen) setScopeMode((initial?.allowedBranchIds?.length ?? 0) > 0 ? 'branches' : 'company')
  }, [isOpen, initial])

  // A list that is already live under the same use type will compete with
  // this one on the same sale. That is the single most common cause of "the
  // till charged the wrong price", so it gets called out before saving
  // rather than discovered afterwards.
  const clashingLists = useMemo(
    () =>
      priceLists.filter(
        (pl) =>
          pl.priceUseTypeId === selectedPriceUseTypeId &&
          pl.status === 'active' &&
          pl.id !== initial?.id
      ),
    [priceLists, selectedPriceUseTypeId, initial?.id]
  )
  const topClashPriority = clashingLists.reduce((max, pl) => Math.max(max, pl.priority), 0)
  const hasClash = clashingLists.length > 0
  const resolution: 'priority' | 'supersede' = supersedesId ? 'supersede' : 'priority'
  const priorityLoses = hasClash && resolution === 'priority' && (priority ?? 0) <= topClashPriority

  const datesOutOfOrder = Boolean(effectiveFrom && effectiveTo && effectiveTo <= effectiveFrom)
  const branchesMissing = scopeMode === 'branches' && allowedBranchIds.length === 0

  type Issue = { key: string; label: string }
  const issues: Issue[] = [
    ...(name.trim()
      ? []
      : [{ key: 'name', label: 'Name is required — this is what cashiers see.' }]),
    ...(selectedPriceUseTypeId
      ? []
      : [{ key: 'type', label: 'Pick the price use type this list prices for.' }]),
    ...(datesOutOfOrder
      ? [{ key: 'dates', label: 'The end date must fall after the start date.' }]
      : []),
    ...(branchesMissing
      ? [
          {
            key: 'branches',
            label: 'Pick at least one branch, or switch back to company-wide.',
          },
        ]
      : []),
  ]

  if (!isOpen) return null

  async function handleFormSubmit(data: PriceListFormValues) {
    // Guard against a stale supersedesId left over from before the Price
    // Use Type was changed mid-edit — only ever submit it when it's still
    // one of the currently-valid (same-type, non-self) candidates.
    const nextSupersedesId = supersedeCandidates.some((pl) => pl.id === data.supersedesId)
      ? data.supersedesId
      : undefined
    const result = await onSubmit({
      ...data,
      effectiveFrom: data.effectiveFrom || undefined,
      effectiveTo: data.effectiveTo || undefined,
      supersedesId: nextSupersedesId,
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

  const submitLabel = isEdit ? 'Save changes' : 'Create price list'

  const scopeSummary =
    scopeMode === 'company'
      ? `All branches${branches.length ? ` (${branches.length})` : ''}`
      : `${allowedBranchIds.length} branch${allowedBranchIds.length === 1 ? '' : 'es'} of ${branches.length}`

  const selectedType = priceUseTypes.find((t) => t.id === selectedPriceUseTypeId)
  const selectedTypeName = selectedType?.name ?? 'Not set'
  const selectableTypes = priceUseTypes.filter((t) => t.isActive || t.id === selectedPriceUseTypeId)

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        width="xl"
        panelClassName={PLEX}
        title={isEdit ? 'Edit price list' : 'New price list'}
        subtitle="One selling price per item under this use type. Items are priced after it exists."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#5b5b6b]">
              {issues.length > 0 ? issues[0].label : 'Everything checks out.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#3d3d4a] hover:bg-[#f1f1f4] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form={FORM_ID}
                disabled={isSubmitting || issues.length > 0}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a189b] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving…' : submitLabel}
              </button>
            </div>
          </div>
        }
      >
        <form
          id={FORM_ID}
          onSubmit={handleSubmit(handleFormSubmit)}
          noValidate
          className="min-h-full bg-[#fbfbfc]"
        >
          <div className="space-y-5 px-6 py-5">
            {/* ── Identity ──────────────────────────────────────────────── */}
            {
              <div className="space-y-5 rounded-xl border border-[#e4e4e9] bg-white p-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#17171c]">Identity</h3>
                  <p className="mt-0.5 text-xs text-[#5b5b6b]">
                    What it is called, what it prices for, and how VAT is treated.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                    Name <span className="text-[#b42318]">*</span>
                  </label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="e.g. Credit Card — Reference Price 2026"
                        className={fieldClass}
                      />
                    )}
                  />
                  <p className="mt-1 text-xs text-[#8b8b9b]">
                    Cashiers pick by this name at the till — lead with the use type.
                  </p>
                  {errors.name && (
                    <p className="mt-1 text-xs text-[#b42318]">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-[#3d3d4a]">
                    Price use type <span className="text-[#b42318]">*</span>
                  </p>
                  <Controller
                    name="priceUseTypeId"
                    control={control}
                    render={({ field }) => (
                      <div
                        role="radiogroup"
                        aria-label="Price use type"
                        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                      >
                        {selectableTypes.map((type) => {
                          const isOn = field.value === type.id
                          return (
                            <button
                              key={type.id}
                              type="button"
                              role="radio"
                              aria-checked={isOn}
                              // The code alone is the accessible name — the
                              // description underneath would otherwise make
                              // every card match every other card's search.
                              aria-label={type.name}
                              onClick={() => field.onChange(type.id)}
                              className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                                isOn
                                  ? 'border-[#5b21b6] bg-[#f1ebfb]/60 ring-2 ring-[#f0e9fc]'
                                  : 'border-[#e4e4e9] bg-white hover:border-[#d3d3db]'
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span
                                  className={`rounded bg-[#f1ebfb] px-2 py-0.5 ${MONO} text-[11px] font-semibold text-[#3f1490]`}
                                >
                                  {type.name}
                                </span>
                                <span
                                  aria-hidden
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                                    isOn ? 'bg-[#5b21b6] text-white' : 'border border-[#d3d3db]'
                                  }`}
                                >
                                  {isOn && <Check className="h-2.5 w-2.5" />}
                                </span>
                              </span>
                              <span className="text-xs leading-snug text-[#5b5b6b]">
                                {type.description || 'No description'}
                              </span>
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setIsCreateTypeOpen(true)}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#d3d3db] p-3 text-xs font-medium text-[#3f1490] hover:border-[#c4a8ec] hover:bg-[#f1ebfb]/50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          New use type
                        </button>
                      </div>
                    )}
                  />
                  {errors.priceUseTypeId && (
                    <p className="mt-1 text-xs text-[#b42318]">{errors.priceUseTypeId.message}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                      Currency
                    </label>
                    <div
                      className={`${fieldClass} flex items-center gap-2 bg-[#fbfbfc] text-[#5b5b6b]`}
                    >
                      <span className={`${MONO} text-xs font-semibold text-[#5b5b6b]`}>PHP</span>
                      Philippine Peso
                    </div>
                    <p className="mt-1 text-xs text-[#8b8b9b]">Set at company level.</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                      VAT treatment
                    </label>

                    {/* Scenario 50 Gap 7 — declares whether the prices on this
                      list already have VAT baked in. Defaults to inclusive,
                      matching the client's stated norm; POS already knows how
                      to price a line either way via the same pricingMode
                      concept on Branch Pricing. */}
                    <Controller
                      name="pricingMode"
                      control={control}
                      render={({ field }) => (
                        <SegmentedControl
                          value={field.value ?? 'inclusive'}
                          onChange={field.onChange}
                          options={[
                            { value: 'inclusive', label: 'VAT inclusive' },
                            { value: 'exclusive', label: 'VAT exclusive' },
                          ]}
                        />
                      )}
                    />
                    <p className="mt-1 text-xs text-[#8b8b9b]">
                      {pricingMode === 'exclusive'
                        ? 'VAT is added on top at the till — use for wholesale or B2B lists.'
                        : 'Prices already contain VAT. Most retail lists are inclusive.'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                    Description{' '}
                    <span className="ml-1 text-xs font-normal text-[#8b8b9b]">optional</span>
                  </label>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={2}
                        placeholder="Who this list is for, and anything the next person should know…"
                        className={`${fieldClass} resize-none`}
                      />
                    )}
                  />
                </div>

                {isEdit && initial && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">Status</label>
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[initial.status] ?? 'bg-[#f1f1f4] text-[#5b5b6b]'}`}
                    >
                      {STATUS_LABELS[initial.status] ?? initial.status}
                    </span>
                    <p className="mt-1 text-xs text-[#8b8b9b]">
                      Set by the approval workflow, not editable here.
                    </p>
                  </div>
                )}

                {isEdit && initial?.status === 'rejected' && initial.remarks && (
                  <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3">
                    <p className="text-xs font-medium text-[#8f1c14]">Rejection reason</p>
                    <p className="mt-0.5 text-sm text-[#b42318]">{initial.remarks}</p>
                  </div>
                )}
              </div>
            }

            {/* ── Coverage ──────────────────────────────────────────────── */}
            {
              <div className="space-y-4">
                <div className="space-y-4 rounded-xl border border-[#e4e4e9] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#17171c]">When it applies</h3>
                    <SegmentedControl
                      value={windowMode}
                      onChange={(mode) => {
                        if (mode === 'always') {
                          setValue('effectiveFrom', '')
                          setValue('effectiveTo', '')
                        } else {
                          setValue('effectiveFrom', new Date().toISOString().slice(0, 10))
                        }
                      }}
                      options={[
                        { value: 'always', label: 'Always on' },
                        { value: 'dated', label: 'Date range' },
                      ]}
                    />
                  </div>

                  {windowMode === 'dated' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                          Effective From
                        </label>
                        <Controller
                          name="effectiveFrom"
                          control={control}
                          render={({ field }) => (
                            <input {...field} type="date" className={fieldClass} />
                          )}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                          Effective To{' '}
                          <span className="ml-1 text-xs font-normal text-[#8b8b9b]">
                            (optional)
                          </span>
                        </label>
                        <Controller
                          name="effectiveTo"
                          control={control}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="date"
                              className={`${fieldClass} ${datesOutOfOrder ? 'border-[#eda9a2] bg-[#fdeceb]' : ''}`}
                            />
                          )}
                        />
                        {datesOutOfOrder && (
                          <p className="mt-1 text-xs text-[#b42318]">
                            End date must fall after the start.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#5b5b6b]">
                      The list stays live until someone deactivates it or a newer version supersedes
                      it.
                    </p>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-[#e4e4e9] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#17171c]">Where it applies</h3>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${branchesMissing ? 'bg-[#fdeceb] text-[#b42318]' : 'bg-[#f1ebfb] text-[#3f1490]'}`}
                    >
                      {scopeSummary}
                    </span>
                  </div>

                  <Controller
                    name="allowedBranchIds"
                    control={control}
                    render={({ field }) => {
                      const selected = field.value ?? []
                      const toggleOne = (branchId: string, checked: boolean) => {
                        field.onChange(
                          checked
                            ? [...selected, branchId]
                            : selected.filter((id) => id !== branchId)
                        )
                      }
                      const toggleGroup = (groupBranches: Branch[], select: boolean) => {
                        const groupIds = new Set(groupBranches.map((b) => b.id))
                        field.onChange(
                          select
                            ? [...new Set([...selected, ...groupIds])]
                            : selected.filter((id) => !groupIds.has(id))
                        )
                      }

                      const query = branchSearch.trim().toLowerCase()
                      const filtered = query
                        ? branches.filter(
                            (b) =>
                              b.name.toLowerCase().includes(query) ||
                              b.code?.toLowerCase().includes(query)
                          )
                        : branches
                      const groups = filtered.reduce<Record<string, Branch[]>>((acc, branch) => {
                        const key = branch.region ?? 'other'
                        ;(acc[key] ??= []).push(branch)
                        return acc
                      }, {})
                      const groupKeys = Object.keys(groups).sort((a, b) =>
                        regionLabel(a).localeCompare(regionLabel(b))
                      )

                      return (
                        <>
                          <SegmentedControl
                            value={scopeMode}
                            onChange={(mode) => {
                              setScopeMode(mode)
                              // Switching back to company-wide has to clear the
                              // picks, not just hide them — an empty array is
                              // what "company-wide" means to the API.
                              if (mode === 'company') field.onChange([])
                            }}
                            options={[
                              { value: 'company', label: 'All branches' },
                              { value: 'branches', label: 'Specific branches' },
                            ]}
                          />

                          {scopeMode === 'company' ? (
                            <p className="text-xs text-[#5b5b6b]">
                              Every branch uses this list. Switch to specific branches only when a
                              region genuinely prices differently — that split is the main reason
                              pricing drifts apart.
                            </p>
                          ) : (
                            <div className="rounded-lg border border-[#e4e4e9]">
                              <div className="flex items-center gap-2 border-b border-[#e4e4e9] px-3 py-2">
                                <Search className="h-4 w-4 shrink-0 text-[#8b8b9b]" />
                                <input
                                  type="text"
                                  value={branchSearch}
                                  onChange={(e) => setBranchSearch(e.target.value)}
                                  placeholder="Search branches by name or code…"
                                  className="flex-1 bg-transparent text-sm text-[#17171c] outline-none placeholder:text-[#8b8b9b]"
                                />
                                {selected.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => field.onChange([])}
                                    className="shrink-0 text-xs font-medium text-[#3f1490] hover:underline"
                                  >
                                    Clear all
                                  </button>
                                )}
                              </div>

                              <div className="max-h-64 space-y-3 overflow-y-auto p-3">
                                {branches.length === 0 && (
                                  <p className="text-xs text-[#8b8b9b]">No branches found.</p>
                                )}
                                {branches.length > 0 && filtered.length === 0 && (
                                  <p className="text-xs text-[#8b8b9b]">
                                    No branches match &ldquo;{branchSearch}&rdquo;.
                                  </p>
                                )}
                                {groupKeys.map((key) => {
                                  const groupBranches = groups[key]
                                  const allSelected = groupBranches.every((b) =>
                                    selected.includes(b.id)
                                  )
                                  return (
                                    <div key={key}>
                                      <div className="mb-1.5 flex items-center justify-between">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8b8b9b]">
                                          {regionLabel(key === 'other' ? undefined : key)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => toggleGroup(groupBranches, !allSelected)}
                                          className="text-[11px] font-medium text-[#3f1490] hover:underline"
                                        >
                                          {allSelected ? 'Deselect all' : 'Select all'}
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                                        {groupBranches.map((branch) => {
                                          const checked = selected.includes(branch.id)
                                          return (
                                            <label
                                              key={branch.id}
                                              className="flex items-center gap-2 text-sm text-[#3d3d4a]"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) =>
                                                  toggleOne(branch.id, e.target.checked)
                                                }
                                              />
                                              <span className="truncate">{branch.name}</span>
                                              {branch.code && (
                                                <span className="shrink-0 text-xs text-[#8b8b9b]">
                                                  {branch.code}
                                                </span>
                                              )}
                                            </label>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    }}
                  />
                </div>

                {/* Clash resolution */}
                <div
                  className={`space-y-4 rounded-xl border bg-white p-5 ${hasClash ? 'border-[#f5e2c6]' : 'border-[#e4e4e9]'}`}
                >
                  <div className="flex items-start gap-2">
                    {hasClash ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d18b1d]" />
                    ) : (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7b52]" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-semibold ${hasClash ? 'text-[#8a4b06]' : 'text-[#0b6644]'}`}
                      >
                        {hasClash
                          ? `${clashingLists.length} live list${clashingLists.length === 1 ? '' : 's'} already price${clashingLists.length === 1 ? 's' : ''} ${selectedTypeName}`
                          : selectedPriceUseTypeId
                            ? `No clash — nothing else is live for ${selectedTypeName}`
                            : 'Pick a price use type to check for clashes'}
                      </p>
                      <p className="mt-0.5 text-xs text-[#5b5b6b]">
                        {hasClash
                          ? `${clashingLists
                              .slice(0, 3)
                              .map((pl) => `${pl.name} (priority ${pl.priority})`)
                              .join(
                                ', '
                              )}${clashingLists.length > 3 ? `, +${clashingLists.length - 3} more` : ''}. Two live lists over the same sale is the usual cause of a wrong price at the till.`
                          : 'Priority only matters when two lists could both apply to the same sale.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                        Priority{' '}
                        <span className="ml-1 text-xs font-normal text-[#8b8b9b]">
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
                            className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${priorityLoses ? 'border-[#eccb95] bg-[#fdf3e7]' : ''}`}
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
                      <p
                        className={`mt-1 text-xs ${priorityLoses ? 'text-[#8a4b06]' : 'text-[#8b8b9b]'}`}
                      >
                        {hasClash
                          ? priorityLoses
                            ? `Below ${topClashPriority} — the live list keeps winning, so this one may never be used.`
                            : `Beats the current top of ${topClashPriority}.`
                          : 'Only matters if this could clash with another price list on the same sale. Leave at 0 if you’re not sure.'}
                      </p>
                      {errors.priority && (
                        <p className="mt-1 text-xs text-[#b42318]">{errors.priority.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#3d3d4a]">
                        Supersedes{' '}
                        <span className="ml-1 text-xs font-normal text-[#8b8b9b]">
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
                      <p className="mt-1 text-xs text-[#8b8b9b]">
                        On approval the superseded list auto-expires, so only one price is ever in
                        force. Only lists under the same Price Use Type are shown.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            }

            {/* ── Review ────────────────────────────────────────────────── */}
            {
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeef1] px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#17171c]">
                        {name.trim() || 'Untitled price list'}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5b5b6b]">
                        <span
                          className={`rounded bg-[#f1ebfb] px-2 py-0.5 ${MONO} text-[11px] font-semibold text-[#3f1490]`}
                        >
                          {selectedType?.name ?? '—'}
                        </span>
                        {pricingMode === 'exclusive' ? 'VAT exclusive' : 'VAT inclusive'} · PHP
                      </p>
                    </div>
                    {!isEdit && (
                      <span className="shrink-0 rounded-md bg-[#fdf3e7] px-2.5 py-1 text-xs font-medium text-[#8a4b06]">
                        Draft — no items priced
                      </span>
                    )}
                  </div>
                  <dl className="divide-y divide-[#eeeef1] text-sm">
                    {[
                      {
                        label: 'Price use type',
                        value: selectedTypeName,
                        note: selectedType ? 'what this list prices for' : 'required',
                        missing: !selectedType,
                      },
                      {
                        label: 'Effective',
                        value: windowMode === 'dated' ? effectiveFrom || 'Not set' : 'Always on',
                        note:
                          windowMode === 'dated'
                            ? effectiveTo
                              ? `until ${effectiveTo}`
                              : 'no end date'
                            : 'until deactivated',
                      },
                      {
                        label: 'Applies to',
                        value: scopeSummary,
                        note: scopeMode === 'company' ? 'company-wide' : 'branch-specific pricing',
                      },
                      {
                        label: 'On a clash',
                        value: !hasClash
                          ? 'No clash'
                          : resolution === 'supersede'
                            ? 'Replaces a list'
                            : `Priority ${priority ?? 0}`,
                        note: !hasClash
                          ? `only live list for ${selectedTypeName}`
                          : resolution === 'supersede'
                            ? (supersedeCandidates.find((pl) => pl.id === supersedesId)?.name ??
                              'not chosen')
                            : `current top is ${topClashPriority}`,
                      },
                      {
                        label: 'Items priced',
                        value: catalogTotal ? `0 of ${catalogTotal.toLocaleString()}` : 'None yet',
                        note: 'added after creation',
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-start justify-between gap-4 px-5 py-3"
                      >
                        <dt className="text-[#5b5b6b]">{row.label}</dt>
                        <dd className="text-right">
                          <p
                            className={`font-medium ${row.missing ? 'text-[#b42318]' : 'text-[#17171c]'}`}
                          >
                            {row.value}
                          </p>
                          <p className="text-[11px] text-[#8b8b9b]">{row.note}</p>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            }
          </div>
        </form>
      </Drawer>

      <PriceUseTypeModal
        isOpen={isCreateTypeOpen}
        onClose={() => setIsCreateTypeOpen(false)}
        onSubmit={handleCreateType}
        isSubmitting={isCreatingPriceUseType}
      />
    </>
  )
}
