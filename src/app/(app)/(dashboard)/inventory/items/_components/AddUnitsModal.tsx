'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, PackagePlus, X } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { CONTROL_CHROME, PLEX } from '@/src/libs/design/plex'
import type { ItemSummary } from '@/src/schema/inventory/items'
import {
  AddUnitsFormSchema,
  parseSerialList,
  type AddUnitsFormValues,
} from '@/src/schema/inventory/items/add-units'
import {
  UNIT_CLASSIFICATION_LABELS,
  UnitClassificationSchema,
} from '@/src/schema/inventory/reports'
import { receiveInitialUnit } from '../_actions/receive-initial-unit'
import { NumericInput } from './item-form-shared'
import { errorClass, inputClass, labelClass } from './itemFormChrome'
import { useOriginOptions, useReceivingWarehouses } from './item-create-fields'

type Props = {
  item: ItemSummary | null
  onClose: () => void
}

const DEFAULTS: AddUnitsFormValues = {
  warehouseId: '',
  dateIn: '',
  rr: '',
  origin: 'WHSE',
  classification: 'brand_new',
  price: undefined,
  serialsText: '',
}

/** The backend's machine codes, said the way a custodian would read them. */
function humanizeAddUnitsError(message: string | undefined): string {
  if (!message) return 'Could not record the units.'
  if (message.startsWith('serial_already_registered')) {
    return `Already registered: ${message.split(':')[1]?.trim() ?? ''}. Remove those serials and try again.`
  }
  if (message.startsWith('rr_already_used')) {
    return 'That RR # is already on another receiving report — use a different RR #.'
  }
  if (message.startsWith('duplicate_serial_in_request')) return 'A serial is listed more than once.'
  if (message === 'unparseable_date') return 'Date in is not a valid date.'
  return message
}

/** Item Master → Add units. Records units the beginning-balance upload missed
 * — serials at one branch under one RR #, with date in, origin, classification
 * and cost — the same provenance a beginning-balance unit carries. */
export default function AddUnitsModal({ item, onClose }: Props): React.JSX.Element | null {
  const isOpen = !!item
  const queryClient = useQueryClient()
  const warehouses = useReceivingWarehouses(isOpen)
  const originOptions = useOriginOptions(isOpen)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddUnitsFormValues>({
    resolver: zodResolver(AddUnitsFormSchema),
    defaultValues: DEFAULTS,
  })

  useEffect(() => {
    if (isOpen) reset(DEFAULTS)
  }, [isOpen, reset])

  async function onSubmit(data: AddUnitsFormValues): Promise<void> {
    if (!item) return
    const res = await receiveInitialUnit(item.id, {
      warehouseId: data.warehouseId,
      dateIn: data.dateIn || undefined,
      rr: data.rr || undefined,
      origin: data.origin || undefined,
      price: data.price,
      classification: data.classification,
      serialNumbers: parseSerialList(data.serialsText),
    })
    if (!res.success) {
      showToast({
        title: 'Units not added',
        description: humanizeAddUnitsError(res.message),
        status: 'error',
      })
      return
    }
    showToast({ title: 'Units added', description: res.message, status: 'success' })
    queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-serial-status-count'] })
    onClose()
  }

  if (!item) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 ${PLEX}`}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <AddUnitsHeader item={item} onClose={onClose} />
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <BranchField control={control} errors={errors} warehouses={warehouses} />
          <TextField
            control={control}
            errors={errors}
            name="dateIn"
            label="Date In (optional — today)"
            type="date"
          />
          <TextField
            control={control}
            errors={errors}
            name="rr"
            label="RR # (optional — generated)"
            placeholder="e.g. RR#163451S"
          />
          <SelectField
            control={control}
            name="origin"
            label="Origin"
            options={originOptions}
            placeholder="Select supplier or WHSE…"
          />
          <SelectField
            control={control}
            name="classification"
            label="Classification"
            options={UnitClassificationSchema.options.map((c) => ({
              value: c,
              label: UNIT_CLASSIFICATION_LABELS[c],
            }))}
          />
          <CostField control={control} />
          <SerialsField control={control} errors={errors} />
        </div>
        <AddUnitsFooter onClose={onClose} isSubmitting={isSubmitting} />
      </form>
    </div>
  )
}

function AddUnitsHeader({
  item,
  onClose,
}: {
  item: ItemSummary
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-[#eeeef1] bg-white px-6 py-4">
      <div className="flex items-start gap-3">
        <PackagePlus className="mt-0.5 h-5 w-5 shrink-0 text-[#5b21b6]" />
        <div>
          <h2 className="text-base font-semibold text-[#1d1d26]">Add units</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {item.name} — record units on hand at a branch that the beginning balance missed.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-lg p-1.5 text-ink-subtle hover:bg-[#f0e9fc] hover:text-[#5b21b6]"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

type FieldProps = { control: Control<AddUnitsFormValues>; errors: FieldErrors<AddUnitsFormValues> }

function BranchField({
  control,
  errors,
  warehouses,
}: FieldProps & {
  warehouses: { id: string; name: string; branch?: { name: string } | null }[]
}): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>Branch</label>
      <Controller
        name="warehouseId"
        control={control}
        render={({ field }) => (
          <SearchableSelect
            chrome={CONTROL_CHROME}
            portal
            value={field.value}
            onChange={field.onChange}
            options={warehouses.map((w) => ({ value: w.id, label: w.branch?.name ?? w.name }))}
            placeholder="Select branch…"
          />
        )}
      />
      {errors.warehouseId && <p className={errorClass}>{errors.warehouseId.message}</p>}
    </div>
  )
}

function TextField({
  control,
  errors,
  name,
  label,
  type = 'text',
  placeholder,
}: FieldProps & {
  name: 'dateIn' | 'rr'
  label: string
  type?: 'text' | 'date'
  placeholder?: string
}): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input {...field} type={type} placeholder={placeholder} className={inputClass} />
        )}
      />
      {errors[name] && <p className={errorClass}>{errors[name]?.message}</p>}
    </div>
  )
}

function SelectField({
  control,
  name,
  label,
  options,
  placeholder,
}: {
  control: Control<AddUnitsFormValues>
  name: 'origin' | 'classification'
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
}): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <SearchableSelect
            chrome={CONTROL_CHROME}
            portal
            value={field.value ?? ''}
            onChange={(v) => field.onChange(v || (name === 'classification' ? 'brand_new' : ''))}
            options={options}
            placeholder={placeholder}
          />
        )}
      />
    </div>
  )
}

function CostField({ control }: { control: Control<AddUnitsFormValues> }): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>Unit Cost (₱)</label>
      <Controller
        name="price"
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
  )
}

function SerialsField({ control, errors }: FieldProps): React.JSX.Element {
  const text = useWatch({ control, name: 'serialsText' })
  const count = parseSerialList(text ?? '').length
  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className={labelClass.replace('mb-1.5 ', '')}>Serial numbers</label>
        <span className="text-[12px] text-ink-subtle">
          {count} unit{count === 1 ? '' : 's'}
        </span>
      </div>
      <Controller
        name="serialsText"
        control={control}
        render={({ field }) => (
          <textarea
            {...field}
            rows={5}
            placeholder={'One per line, or comma-separated\nSN-001\nSN-002'}
            className={`${inputClass} font-mono`}
          />
        )}
      />
      {errors.serialsText && <p className={errorClass}>{errors.serialsText.message}</p>}
    </div>
  )
}

function AddUnitsFooter({
  onClose,
  isSubmitting,
}: {
  onClose: () => void
  isSubmitting: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-[#eeeef1] px-6 py-4">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:bg-[#f0e9fc] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4c1a9b] disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Adding…' : 'Add units'}
      </button>
    </div>
  )
}
