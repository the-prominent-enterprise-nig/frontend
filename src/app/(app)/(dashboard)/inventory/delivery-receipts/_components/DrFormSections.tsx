'use client'

import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { CONTROL_CHROME } from '@/src/libs/design/plex'
import { locationLabel } from '@/src/libs/format/locationLabel'
import {
  DR_PURPOSE_CONFIG,
  DR_PURPOSE_GROUPS,
} from '@/src/libs/inventory/delivery-receipt-purposes'
import {
  RAFFLE_OCCASIONS,
  type DrCustomerLookup,
  type DrFormValues,
} from '@/src/schema/inventory/delivery-receipts'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getDrDepartments } from '../_actions/dr-lookups'
import { DrCustomerCombobox } from './DrCustomerCombobox'
import { Field, INPUT, READONLY, Section, TEXTAREA } from './drFormUi'

/** A field spanning two of the recipient grid's four wide-screen columns. */
const WIDE = 'sm:col-span-2'

// ─── Purpose ──────────────────────────────────────────────────────────────────

/** Grouped the way the client wrote the list; SearchableSelect draws a
 * heading wherever the group changes. */
const PURPOSE_OPTIONS = DR_PURPOSE_GROUPS.flatMap((group) =>
  group.purposes.map((p) => ({
    value: p,
    label: `${DR_PURPOSE_CONFIG[p].label}${DR_PURPOSE_CONFIG[p].comingLater ? ' — draft only for now' : ''}`,
    group: group.label,
  }))
)

const OCCASION_OPTIONS = [
  ...RAFFLE_OCCASIONS.map((o) => ({ value: o, label: o })),
  { value: 'Other', label: 'Other (specify)' },
]

export function DrPurposeSection(): React.JSX.Element {
  const { control, formState } = useFormContext<DrFormValues>()
  const purpose = useWatch({ control, name: 'purpose' })
  const config = DR_PURPOSE_CONFIG[purpose]
  return (
    <Section
      title="Purpose"
      description="Decides how stock and accounts are affected when this DR is approved."
    >
      <Field label="Purpose of delivery" required>
        <Controller
          control={control}
          name="purpose"
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onChange={(value) => {
                if (value) field.onChange(value)
              }}
              options={PURPOSE_OPTIONS}
              placeholder="Select purpose…"
              chrome={CONTROL_CHROME}
            />
          )}
        />
      </Field>
      <div className="rounded-lg bg-[#f1ebfb] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#3f1490]">
        {config.effect}
        {config.comingLater && (
          <span className="mt-1.5 block font-medium">
            You can save this as a draft, but it can&apos;t be submitted yet — its approval step is
            still being built.
          </span>
        )}
      </div>
      {config.requiresOccasion && <OccasionField error={formState.errors.occasion?.message} />}
    </Section>
  )
}

function OccasionField({ error }: { error?: string }): React.JSX.Element {
  const { control } = useFormContext<DrFormValues>()
  const occasion = useWatch({ control, name: 'occasion' })
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Occasion" required error={error}>
        <Controller
          control={control}
          name="occasion"
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onChange={(value) => field.onChange(value)}
              options={OCCASION_OPTIONS}
              placeholder="Select occasion…"
              chrome={CONTROL_CHROME}
            />
          )}
        />
      </Field>
      {occasion === 'Other' && (
        <Field label="Which occasion?" required>
          <Controller
            control={control}
            name="occasionOther"
            render={({ field }) => (
              <input {...field} className={INPUT} placeholder="e.g. Anniversary Party" />
            )}
          />
        </Field>
      )}
    </div>
  )
}

// ─── Issue details ────────────────────────────────────────────────────────────

export function DrIssueSection({
  drNumber,
  memoNumber,
  onWarehouseChange,
}: {
  drNumber?: string
  memoNumber?: string
  /** Lines are tied to the issuing warehouse's shelf, so changing it has to
   * clear them — the parent owns the lines. */
  onWarehouseChange: (warehouseId: string) => void
}): React.JSX.Element {
  const { control, formState } = useFormContext<DrFormValues>()
  const purpose = useWatch({ control, name: 'purpose' })
  const config = DR_PURPOSE_CONFIG[purpose]
  const errors = formState.errors
  return (
    <Section title="Issue details" description="Where the stock leaves from and who receives it.">
      {/* The two document numbers share a row; DR no. takes all of it when
          the purpose carries no debit memo. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="DR no." className={config.withDebitMemo ? '' : 'sm:col-span-2'}>
          <div className={READONLY}>{drNumber ?? 'Assigned on save'}</div>
        </Field>
        {config.withDebitMemo && (
          <Field label="Debit memo no.">
            <div className={READONLY}>{memoNumber ?? 'Assigned on approval'}</div>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Issue date" required error={errors.issueDate?.message}>
          <Controller
            control={control}
            name="issueDate"
            render={({ field }) => <input {...field} type="date" className={INPUT} />}
          />
        </Field>
        <WarehouseField error={errors.warehouseId?.message} onChange={onWarehouseChange} />
        <DepartmentField
          required={!!config.requiresDepartment}
          error={errors.departmentId?.message}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CounterpartyField />
        <RecipientFields hasPicker={config.counterparty !== 'none'} />
      </div>
    </Section>
  )
}

function WarehouseField({
  error,
  onChange,
}: {
  error?: string
  onChange: (warehouseId: string) => void
}): React.JSX.Element {
  const { control } = useFormContext<DrFormValues>()
  // Branch-scoped server-side: a branch user only gets their own branch.
  const warehouses = useQuery({
    queryKey: ['dr-issuing-warehouses'],
    queryFn: () => getWarehouses({ status: 'active', limit: 200 }),
    staleTime: 5 * 60_000,
  })
  const options = (warehouses.data?.data?.data ?? []).map((w) => ({
    value: w.id,
    label: locationLabel(w),
  }))
  return (
    <Field label="Issuing branch" required error={error}>
      <Controller
        control={control}
        name="warehouseId"
        render={({ field }) => (
          <SearchableSelect
            value={field.value}
            onChange={(value) => {
              if (value !== field.value) onChange(value)
            }}
            options={options}
            loading={warehouses.isLoading}
            placeholder="Select branch…"
            chrome={CONTROL_CHROME}
          />
        )}
      />
    </Field>
  )
}

function DepartmentField({
  required,
  error,
}: {
  required: boolean
  error?: string
}): React.JSX.Element {
  const { control } = useFormContext<DrFormValues>()
  const departments = useQuery({
    queryKey: ['dr-departments'],
    queryFn: () => getDrDepartments(),
    staleTime: 5 * 60_000,
  })
  const options = (departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))
  return (
    <Field label="Department" required={required} error={error}>
      <Controller
        control={control}
        name="departmentId"
        render={({ field }) => (
          <SearchableSelect
            value={field.value}
            onChange={(value) => field.onChange(value)}
            options={options}
            loading={departments.isLoading}
            placeholder={required ? 'Select department…' : 'Optional'}
            chrome={CONTROL_CHROME}
            clearable
          />
        )}
      />
    </Field>
  )
}

/** The CRM customer or the supplier, depending on the purpose. Picking one
 * fills the recipient fields below; they stay editable. */
function CounterpartyField(): React.JSX.Element | null {
  const { control, setValue, formState } = useFormContext<DrFormValues>()
  const [purpose, customerLabel, supplierLabel] = useWatch({
    control,
    name: ['purpose', 'customerLabel', 'supplierLabel'],
  })
  const kind = DR_PURPOSE_CONFIG[purpose].counterparty
  const required = purpose === 'sales_invoice_to_follow' || purpose === 'return_to_supplier'
  if (kind === 'none') return null

  function pickCustomer(c: DrCustomerLookup | null): void {
    const opts = { shouldDirty: true }
    setValue('customerId', c?.id ?? '', opts)
    setValue('customerLabel', c?.name ?? '', opts)
    if (!c) return
    setValue('deliveredTo', c.name, opts)
    setValue('customerCode', c.customerCode, opts)
    setValue('address', c.address ?? '', opts)
    setValue('contactNo', c.phone ?? '', opts)
  }

  if (kind === 'customer') {
    return (
      <Field
        className={WIDE}
        label="Customer (from CRM)"
        required={required}
        error={formState.errors.customerId?.message}
      >
        <Controller
          control={control}
          name="customerId"
          render={({ field }) => (
            <DrCustomerCombobox
              value={field.value}
              initialLabel={customerLabel}
              onPick={pickCustomer}
            />
          )}
        />
      </Field>
    )
  }
  return (
    <Field
      className={WIDE}
      label="Supplier"
      required={required}
      error={formState.errors.supplierId?.message}
    >
      <Controller
        control={control}
        name="supplierId"
        render={({ field }) => (
          <SupplierSearchCombobox
            value={field.value}
            initialLabel={supplierLabel}
            onChange={(id) => field.onChange(id)}
            onSelect={(option) => {
              setValue('supplierLabel', option.primary)
              setValue('deliveredTo', option.primary, { shouldDirty: true })
            }}
          />
        )}
      />
    </Field>
  )
}

/** With a customer/supplier picker beside Delivered to, Address shares its
 * row with Customer ID and Contact no.; without one it takes a row of its own. */
function RecipientFields({ hasPicker }: { hasPicker: boolean }): React.JSX.Element {
  const { control } = useFormContext<DrFormValues>()
  const text = (
    name: 'deliveredTo' | 'customerCode' | 'address' | 'contactNo',
    placeholder: string
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <input {...field} className={INPUT} placeholder={placeholder} />}
    />
  )
  return (
    <>
      <Field className={WIDE} label="Delivered to">
        {text('deliveredTo', 'Name of person or organization')}
      </Field>
      <Field label="Customer ID">{text('customerCode', 'Customer ID')}</Field>
      <Field label="Contact no.">{text('contactNo', '09xx xxx xxxx')}</Field>
      <Field className={hasPicker ? WIDE : 'sm:col-span-2 lg:col-span-4'} label="Address">
        {text('address', 'Street, barangay, city')}
      </Field>
    </>
  )
}

// ─── Reference and approval ───────────────────────────────────────────────────

export function DrReferenceSection(): React.JSX.Element {
  const { control, formState } = useFormContext<DrFormValues>()
  return (
    <Section
      title="Reference and approval"
      description="Same fields for every purpose. Link the document this delivery relates to."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Reference no.">
          <Controller
            control={control}
            name="referenceNo"
            render={({ field }) => (
              <input {...field} className={INPUT} placeholder="Request memo no." />
            )}
          />
        </Field>
        <Field label="Reference date">
          <Controller
            control={control}
            name="referenceDate"
            render={({ field }) => <input {...field} type="date" className={INPUT} />}
          />
        </Field>
      </div>
      <Field label="Reason / details" required error={formState.errors.reason?.message}>
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <textarea {...field} className={TEXTAREA} placeholder="Why is this stock leaving?" />
          )}
        />
      </Field>
    </Section>
  )
}
