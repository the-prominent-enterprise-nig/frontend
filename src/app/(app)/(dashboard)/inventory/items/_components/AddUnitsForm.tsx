'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Controller, useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, PackagePlus } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { CONTROL_CHROME, MONO, PLEX } from '@/src/libs/design/plex'
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
import { FormSection, NumericInput } from './item-form-shared'
import { errorClass, inputClass, labelClass } from './itemFormChrome'
import { useOriginOptions, useReceivingWarehouses } from './item-create-fields'

type Props = {
  item: ItemSummary
  /** Arrived straight from Add Item's Create — offer to skip instead of
   * going back. */
  isNewItem?: boolean
}

const ITEM_MASTER = '/inventory/items'

function defaultsFor(item: ItemSummary): AddUnitsFormValues {
  return {
    warehouseId: '',
    dateIn: '',
    rr: '',
    origin: 'WHSE',
    classification: 'brand_new',
    price: undefined,
    serialsText: '',
    isSerialTracked: item.isSerialTracked ?? false,
  }
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

function useSubmitUnits(item: ItemSummary): (data: AddUnitsFormValues) => Promise<void> {
  const router = useRouter()
  const queryClient = useQueryClient()
  return async (data) => {
    const res = await receiveInitialUnit(item.id, {
      warehouseId: data.warehouseId,
      dateIn: data.dateIn || undefined,
      rr: data.rr || undefined,
      origin: data.origin || undefined,
      price: data.price,
      classification: data.classification,
      serialNumbers: item.isSerialTracked ? parseSerialList(data.serialsText) : undefined,
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
    router.push(ITEM_MASTER)
  }
}

/** Item Master → Add units, and the step after Add Item's Create. Records
 * units on hand at one branch under one RR # — date in, origin,
 * classification and cost — with the same rules as the bulk sheet's unit
 * columns (both go through the backend's one receipt writer). */
export default function AddUnitsForm({ item, isNewItem = false }: Props): React.JSX.Element {
  const warehouses = useReceivingWarehouses(true)
  const originOptions = useOriginOptions(true)
  const onSubmit = useSubmitUnits(item)
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddUnitsFormValues>({
    resolver: zodResolver(AddUnitsFormSchema),
    defaultValues: defaultsFor(item),
  })

  return (
    <div
      role="region"
      aria-label="Add units"
      className={`flex flex-1 flex-col bg-[#f2f2f3] ${PLEX}`}
    >
      <AddUnitsHeader item={item} isNewItem={isNewItem} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col">
        <div className="flex-1 px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
            <FormSection variant="card" title="Units" errorCount={Object.keys(errors).length}>
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
              {item.isSerialTracked && <SerialsField control={control} errors={errors} />}
            </FormSection>
          </div>
        </div>
        <AddUnitsFooter isNewItem={isNewItem} isSubmitting={isSubmitting} />
      </form>
    </div>
  )
}

function AddUnitsHeader({
  item,
  isNewItem,
}: {
  item: ItemSummary
  isNewItem: boolean
}): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-[#e4e4e9] bg-white px-6 py-4">
      <p className={`${MONO} mb-1 text-[10.5px] uppercase tracking-[0.08em] text-ink-subtle`}>
        Inventory &rsaquo; Item Master &rsaquo; Add units
      </p>
      <div className="flex items-start gap-3">
        <PackagePlus className="mt-1 h-5 w-5 shrink-0 text-[#5b21b6]" />
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#17171c]">
            Add units — {item.name}
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            {isNewItem
              ? 'Item created. Record the units already on hand, or skip if there is no stock yet.'
              : 'Record units on hand at a branch, all under one RR #.'}
          </p>
        </div>
      </div>
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
      <label className={labelClass}>
        Branch <span className="text-[#b42318]">*</span>
      </label>
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
        <label className={labelClass.replace('mb-1.5 ', '')}>
          Serial Numbers <span className="text-[#b42318]">*</span>
        </label>
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
  isNewItem,
  isSubmitting,
}: {
  isNewItem: boolean
  isSubmitting: boolean
}): React.JSX.Element {
  return (
    <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-4 border-t border-[#e4e4e9] bg-white px-6 py-3.5">
      <span className="hidden text-[12px] text-ink-muted sm:block">
        Required fields are marked <span className="text-[#b42318]">*</span>
      </span>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href={ITEM_MASTER}
          aria-disabled={isSubmitting}
          className={`rounded-lg px-4 py-2 text-[13px] font-medium text-ink-muted hover:bg-[#f1f1f4] ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}
        >
          {isNewItem ? 'Skip, no stock yet' : 'Back to Item Master'}
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Adding…' : 'Add units'}
        </button>
      </div>
    </div>
  )
}
