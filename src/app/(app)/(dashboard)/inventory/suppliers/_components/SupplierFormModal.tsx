'use client'

import { useEffect } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  CreateSupplierFormSchema,
  SUPPLIER_ONBOARDING_STATUSES,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  type CreateSupplierFormValues,
  type SupplierDetail,
} from '@/src/schema/inventory/suppliers'
import { Select } from '@/src/components/ui/Select'
import CategorySelect from '@/src/components/ui/CategorySelect'
import { MONO, PLEX } from '@/src/libs/design/plex'
import {
  CURRENCY_OPTIONS,
  ONBOARDING_META,
  STATUS_META,
  TYPE_LABELS,
  termsOptions,
} from '../_lib/supplier-format'

type AccountOption = { id: string; name: string; number?: string }

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  initialData?: SupplierDetail | null
  accountOptions?: AccountOption[]
  /** Every other supplier's code, lowercased — a clash is caught here rather
   * than coming back off the server as a unique-constraint error. */
  existingCodes?: string[]
  onClose: () => void
  onSubmit: (data: CreateSupplierFormValues) => Promise<void>
  isSubmitting?: boolean
}

const cardClass = 'rounded-xl border border-[#e4e4e9] bg-white px-4 py-4 md:px-5'
const labelClass = 'block text-xs font-medium text-[#3d3d4a]'
const fieldClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-sm text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'
const badFieldClass =
  'w-full rounded-lg border border-[#b42318] bg-[#fdeceb] px-3 py-2 text-sm text-[#17171c] outline-none focus:border-[#b42318]'
const sectionHeadClass = 'text-[13.5px] font-semibold text-[#17171c]'
const sectionNoteClass = 'text-[11.5px] leading-relaxed text-[#5b5b6b]'
const hintClass = 'text-[11px] text-[#5b5b6b]'
const errorClass = 'text-[11px] font-medium text-[#b42318]'

const EMPTY_DEFAULTS: CreateSupplierFormValues = {
  code: '',
  name: '',
  legalName: undefined,
  taxId: undefined,
  contactPerson: undefined,
  email: undefined,
  phone: undefined,
  address: undefined,
  paymentTerms: 'Net 30',
  discountTerms: undefined,
  currency: 'PHP',
  bankAccounts: [],
  creditLimit: undefined,
  onboardingStatus: undefined,
  status: undefined,
  notes: undefined,
  type: 'SUPPLIER',
  businessType: undefined,
  alphanumericTaxCode: undefined,
  taxRate: undefined,
  defaultInputVat: 'pct_12',
  defaultWithholding: 'pct_1',
  defaultPayableAccountId: undefined,
  defaultExpenseAccountId: undefined,
}

function toFormValues(supplier: SupplierDetail): CreateSupplierFormValues {
  return {
    code: supplier.code,
    name: supplier.name,
    legalName: supplier.legalName ?? undefined,
    taxId: supplier.taxId ?? undefined,
    contactPerson: supplier.contactPerson ?? undefined,
    email: supplier.email ?? undefined,
    phone: supplier.phone ?? undefined,
    address: supplier.address ?? undefined,
    paymentTerms: supplier.paymentTerms ?? undefined,
    discountTerms: supplier.discountTerms ?? undefined,
    currency: supplier.currency ?? undefined,
    bankAccounts: (supplier.bankAccounts ?? []).map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName ?? undefined,
      isPrimary: account.isPrimary,
    })),
    creditLimit: supplier.creditLimit ?? undefined,
    onboardingStatus: supplier.onboardingStatus,
    status: supplier.status,
    notes: supplier.notes ?? undefined,
    type: supplier.type,
    businessType: supplier.businessType ?? undefined,
    alphanumericTaxCode: supplier.alphanumericTaxCode ?? undefined,
    taxRate: supplier.taxRate ?? undefined,
    defaultInputVat: supplier.defaultInputVat ?? 'pct_12',
    defaultWithholding: supplier.defaultWithholding ?? 'pct_1',
    defaultPayableAccountId: supplier.defaultPayableAccountId ?? undefined,
    defaultExpenseAccountId: supplier.defaultExpenseAccountId ?? undefined,
  }
}

/** The two-button pill group the tax defaults use — a choice between exactly
 * two values reads better as both of them side by side than as a dropdown
 * that hides one. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  ariaLabel: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg border border-[#e4e4e9] bg-[#faf9fb] p-1"
    >
      {options.map((option) => {
        const isOn = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isOn}
            className={`flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] ${
              isOn ? 'bg-[#5b21b6] font-medium text-white' : 'text-[#5b5b6b] hover:text-[#17171c]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function SupplierFormModal({
  open,
  mode,
  initialData,
  accountOptions = [],
  existingCodes = [],
  onClose,
  onSubmit,
  isSubmitting,
}: Props) {
  const isEdit = mode === 'edit'

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<CreateSupplierFormValues>({
    resolver: zodResolver(CreateSupplierFormSchema),
    defaultValues: EMPTY_DEFAULTS,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'bankAccounts' })

  useEffect(() => {
    if (!open) {
      reset(EMPTY_DEFAULTS)
      return
    }
    reset(isEdit && initialData ? toFormValues(initialData) : EMPTY_DEFAULTS)
  }, [open, isEdit, initialData, reset])

  const code = useWatch({ control, name: 'code' }) ?? ''
  const name = useWatch({ control, name: 'name' }) ?? ''
  const banks = useWatch({ control, name: 'bankAccounts' }) ?? []
  const paymentTerms = useWatch({ control, name: 'paymentTerms' })

  const trimmedCode = code.trim()
  const codeTaken = trimmedCode !== '' && existingCodes.includes(trimmedCode.toLowerCase())

  const accountSelectOptions = accountOptions.map((account) => ({
    id: account.id,
    name: account.number ? `${account.number} — ${account.name}` : account.name,
    depth: 0,
  }))

  /** Exactly one account can be the one payments go to, so picking a primary
   * takes it off whichever row had it. */
  function makePrimary(index: number) {
    const current = getValues('bankAccounts') ?? []
    current.forEach((_, i) => {
      setValue(`bankAccounts.${i}.isPrimary`, i === index, { shouldDirty: true })
    })
  }

  function removeBank(index: number) {
    const wasPrimary = (getValues(`bankAccounts.${index}.isPrimary`) ?? false) as boolean
    remove(index)
    // Never leave a set of accounts with no primary — the payment run would
    // have nothing to aim at.
    if (wasPrimary) {
      const left = getValues('bankAccounts') ?? []
      if (left.length > 0) setValue('bankAccounts.0.isPrimary', true, { shouldDirty: true })
    }
  }

  // What is still missing, said in the footer rather than only under the
  // fields — on a form this tall the offending box is usually off-screen.
  const blocking: string[] = []
  if (trimmedCode === '') blocking.push('The supplier code is required.')
  else if (codeTaken) blocking.push(`${trimmedCode} is already another supplier's code.`)
  if (name.trim() === '') blocking.push('The name is required.')
  if (banks.some((b) => !b?.bankName?.trim() || !b?.accountNumber?.trim()))
    blocking.push('Every bank account needs a bank name and an account number.')
  if (errors.email) blocking.push('That does not look like an email address.')

  if (!open) return null

  return (
    // `absolute`, not `fixed` — the app layout's <main> is a relative frame put
    // there for exactly this, so the form fills the content area and leaves the
    // sidebar and top bar reachable. Same shell the PO, transfer, price-list
    // and debit-memo forms use.
    <div className={`absolute inset-0 z-50 flex flex-col bg-[#f7f7f8] ${PLEX}`}>
      <div className="flex-none border-b border-[#e4e4e9] bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-[#17171c]">
                {isEdit ? 'Edit supplier' : 'New supplier'}
              </h2>
              {isEdit && initialData && (
                <span
                  className={`${MONO} rounded-md bg-[#f1ebfb] px-2.5 py-1 text-[11.5px] font-medium text-[#3f1490]`}
                >
                  {initialData.code}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#5b5b6b]">
              A code and a name are all that is required — everything else can follow.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-3.5">
            {/* ── Identity ──────────────────────────────────── */}
            <section className={cardClass}>
              <div className="mb-3.5">
                <h3 className={sectionHeadClass}>Identity</h3>
                <p className={sectionNoteClass}>
                  How this supplier is referred to across the system.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-code">
                    Supplier code <span className="text-[#b42318]">*</span>
                  </label>
                  <Controller
                    name="code"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-code"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        type="text"
                        placeholder="e.g. SUP-0038"
                        className={`${codeTaken || errors.code ? badFieldClass : fieldClass} ${MONO}`}
                      />
                    )}
                  />
                  <p className={codeTaken || errors.code ? errorClass : hintClass}>
                    {codeTaken
                      ? `${trimmedCode} is already taken.`
                      : (errors.code?.message ??
                        'Unique, up to 30 characters. Appears on every document.')}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-name">
                    Name <span className="text-[#b42318]">*</span>
                  </label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-name"
                        value={field.value ?? ''}
                        type="text"
                        placeholder="The trading name people recognise"
                        className={errors.name ? badFieldClass : fieldClass}
                      />
                    )}
                  />
                  {errors.name && <p className={errorClass}>{errors.name.message}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-legal">
                    Legal name
                  </label>
                  <Controller
                    name="legalName"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-legal"
                        value={field.value ?? ''}
                        type="text"
                        placeholder="As registered — for contracts and the BIR"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-tin">
                    Tax ID / TIN
                  </label>
                  <Controller
                    name="taxId"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-tin"
                        value={field.value ?? ''}
                        type="text"
                        placeholder="000-000-000-000"
                        className={`${fieldClass} ${MONO}`}
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Type</label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? 'SUPPLIER'}
                        onChange={(value) =>
                          field.onChange(value as CreateSupplierFormValues['type'])
                        }
                        options={SUPPLIER_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
                      />
                    )}
                  />
                  <p className={hintClass}>
                    Anything other than Supplier is an AP payee — a contractor, a consultant — that
                    carries no stock.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-business-type">
                    Business type
                  </label>
                  <Controller
                    name="businessType"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-business-type"
                        value={field.value ?? ''}
                        type="text"
                        placeholder="e.g. Appliance distributor"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>
              </div>
            </section>

            {/* ── Contact ───────────────────────────────────── */}
            <section className={cardClass}>
              <div className="mb-3.5">
                <h3 className={sectionHeadClass}>Contact</h3>
                <p className={sectionNoteClass}>Who to chase when a delivery is late.</p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-contact">
                    Contact person
                  </label>
                  <Controller
                    name="contactPerson"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-contact"
                        value={field.value ?? ''}
                        type="text"
                        placeholder="Full name"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-phone">
                    Phone
                  </label>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-phone"
                        value={field.value ?? ''}
                        type="tel"
                        placeholder="+63 ..."
                        className={fieldClass}
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-email">
                    Email
                  </label>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-email"
                        value={field.value ?? ''}
                        type="email"
                        placeholder="name@company.com"
                        className={errors.email ? badFieldClass : fieldClass}
                      />
                    )}
                  />
                  {errors.email && <p className={errorClass}>{errors.email.message}</p>}
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className={labelClass} htmlFor="supplier-address">
                    Address
                  </label>
                  <Controller
                    name="address"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        id="supplier-address"
                        value={field.value ?? ''}
                        rows={2}
                        placeholder="Street, city, province"
                        className={`${fieldClass} resize-y`}
                      />
                    )}
                  />
                </div>
              </div>
            </section>

            {/* ── Buying terms ──────────────────────────────── */}
            <section className={cardClass}>
              <div className="mb-3.5">
                <h3 className={sectionHeadClass}>Buying terms</h3>
                <p className={sectionNoteClass}>
                  The defaults every purchase order raised against this supplier inherits.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Payment terms</label>
                  <Controller
                    name="paymentTerms"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        options={termsOptions(paymentTerms)}
                        placeholder="Pick terms…"
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-discount">
                    Discount terms
                  </label>
                  <Controller
                    name="discountTerms"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-discount"
                        value={field.value ?? ''}
                        type="text"
                        placeholder="e.g. 2/10 net 30"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Currency</label>
                  <Controller
                    name="currency"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? 'PHP'}
                        onChange={field.onChange}
                        options={CURRENCY_OPTIONS}
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-credit">
                    Credit limit
                  </label>
                  <Controller
                    name="creditLimit"
                    control={control}
                    render={({ field }) => (
                      <input
                        id="supplier-credit"
                        type="number"
                        min="0"
                        step="0.01"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                        }
                        placeholder="0.00"
                        className={`${errors.creditLimit ? badFieldClass : fieldClass} ${MONO} text-right`}
                      />
                    )}
                  />
                  <p className={errors.creditLimit ? errorClass : hintClass}>
                    {errors.creditLimit?.message ?? 'Blank means no limit is enforced.'}
                  </p>
                </div>
              </div>
            </section>

            {/* ── Tax defaults ──────────────────────────────── */}
            <section className={cardClass}>
              <div className="mb-3.5">
                <h3 className={sectionHeadClass}>Tax defaults</h3>
                <p className={sectionNoteClass}>
                  Prefilled on receiving reports and debit memos, and overridable per document.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Default input VAT</label>
                  <Controller
                    name="defaultInputVat"
                    control={control}
                    render={({ field }) => (
                      <Segmented
                        ariaLabel="Default input VAT"
                        value={field.value ?? 'pct_12'}
                        onChange={field.onChange}
                        options={[
                          { value: 'pct_12', label: '12%' },
                          { value: 'none', label: 'None' },
                        ]}
                      />
                    )}
                  />
                  <p className={hintClass}>
                    Whether receiving from them backs out claimable input VAT.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Default withholding</label>
                  <Controller
                    name="defaultWithholding"
                    control={control}
                    render={({ field }) => (
                      <Segmented
                        ariaLabel="Default withholding"
                        value={field.value ?? 'pct_1'}
                        onChange={field.onChange}
                        options={[
                          { value: 'pct_1', label: '1%' },
                          { value: 'none', label: 'None' },
                        ]}
                      />
                    )}
                  />
                  <p className={hintClass}>Held back from the payment and remitted (BIR 2307).</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-atc">
                    ATC
                  </label>
                  <Controller
                    name="alphanumericTaxCode"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-atc"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        type="text"
                        placeholder="e.g. WC158"
                        className={`${fieldClass} ${MONO}`}
                      />
                    )}
                  />
                  <p className={hintClass}>The alphanumeric tax code on the 2307.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} htmlFor="supplier-tax-rate">
                    Tax rate
                  </label>
                  <Controller
                    name="taxRate"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        id="supplier-tax-rate"
                        value={field.value ?? ''}
                        type="text"
                        placeholder="e.g. 1%"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>
              </div>
            </section>

            {/* ── Accounting ────────────────────────────────── */}
            <section className={cardClass}>
              <div className="mb-3.5">
                <h3 className={sectionHeadClass}>Accounting</h3>
                <p className={sectionNoteClass}>
                  Where this supplier&apos;s bills post. Left blank, they follow the shared mapping.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Default AP account</label>
                  <Controller
                    name="defaultPayableAccountId"
                    control={control}
                    render={({ field }) => (
                      <CategorySelect
                        value={field.value || undefined}
                        onChange={(value) => field.onChange(value ?? undefined)}
                        options={accountSelectOptions}
                        placeholder="Use the default mapping"
                        noun="accounts"
                        aria-label="Default AP account"
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Default expense account</label>
                  <Controller
                    name="defaultExpenseAccountId"
                    control={control}
                    render={({ field }) => (
                      <CategorySelect
                        value={field.value || undefined}
                        onChange={(value) => field.onChange(value ?? undefined)}
                        options={accountSelectOptions}
                        placeholder="Use the default mapping"
                        noun="accounts"
                        aria-label="Default expense account"
                      />
                    )}
                  />
                </div>
              </div>
            </section>

            {/* ── Bank accounts ─────────────────────────────── */}
            <section className={cardClass}>
              <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={sectionHeadClass}>Bank accounts</h3>
                  <p className={sectionNoteClass}>
                    {fields.length > 0
                      ? `${fields.length} of 20 · the primary one is where payments go`
                      : 'Needed before any payment can be released.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={fields.length >= 20}
                  onClick={() =>
                    append({
                      bankName: '',
                      accountNumber: '',
                      accountName: undefined,
                      isPrimary: fields.length === 0,
                    })
                  }
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-2 text-xs font-medium text-[#3f1490] hover:bg-[#e9dffa] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add account
                </button>
              </div>

              {fields.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#d3d3db] px-4 py-6 text-center text-[12.5px] text-[#5b5b6b]">
                  None yet. Payments cannot be released without one, but it can be added later.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {fields.map((field, index) => {
                    const isPrimary = banks[index]?.isPrimary ?? false
                    const rowErrors = errors.bankAccounts?.[index]
                    return (
                      <div
                        key={field.id}
                        className={`flex flex-col gap-3 rounded-xl px-4 py-3.5 ${
                          isPrimary
                            ? 'border border-[#cfe9dd] bg-[#fbfefc]'
                            : 'border border-[#e4e4e9] bg-[#fbfbfc]'
                        }`}
                      >
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="flex flex-col gap-1.5">
                            <label className={labelClass}>
                              Bank name <span className="text-[#b42318]">*</span>
                            </label>
                            <Controller
                              name={`bankAccounts.${index}.bankName`}
                              control={control}
                              render={({ field: bankField }) => (
                                <input
                                  {...bankField}
                                  value={bankField.value ?? ''}
                                  type="text"
                                  placeholder="e.g. BDO Unibank"
                                  className={rowErrors?.bankName ? badFieldClass : fieldClass}
                                />
                              )}
                            />
                            {rowErrors?.bankName && (
                              <p className={errorClass}>{rowErrors.bankName.message}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className={labelClass}>
                              Account number <span className="text-[#b42318]">*</span>
                            </label>
                            <Controller
                              name={`bankAccounts.${index}.accountNumber`}
                              control={control}
                              render={({ field: numberField }) => (
                                <input
                                  {...numberField}
                                  value={numberField.value ?? ''}
                                  type="text"
                                  placeholder="0000 0000 0000"
                                  className={`${rowErrors?.accountNumber ? badFieldClass : fieldClass} ${MONO}`}
                                />
                              )}
                            />
                            {rowErrors?.accountNumber && (
                              <p className={errorClass}>{rowErrors.accountNumber.message}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className={labelClass}>Account name</label>
                            <Controller
                              name={`bankAccounts.${index}.accountName`}
                              control={control}
                              render={({ field: holderField }) => (
                                <input
                                  {...holderField}
                                  value={holderField.value ?? ''}
                                  type="text"
                                  placeholder="Account holder"
                                  className={fieldClass}
                                />
                              )}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeef1] pt-3">
                          <button
                            type="button"
                            onClick={() => makePrimary(index)}
                            aria-pressed={isPrimary}
                            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] ${
                              isPrimary
                                ? 'border border-[#cfe9dd] bg-[#e7f5ef] font-semibold text-[#0b6644]'
                                : 'border border-[#d3d3db] bg-white text-[#3d3d4a] hover:border-[#a3a3b2]'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded text-[9px] ${
                                isPrimary
                                  ? 'bg-[#0f7b52] text-white'
                                  : 'border border-[#d3d3db] bg-white text-transparent'
                              }`}
                            >
                              {'✓'}
                            </span>
                            Primary account for payments
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBank(index)}
                            title="Remove this bank account"
                            className="flex items-center gap-1.5 rounded-lg border border-[#f3c9c5] bg-white px-3 py-1.5 text-xs font-medium text-[#b42318] hover:bg-[#fff5f4]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── Status and notes ──────────────────────────── */}
            <section className={cardClass}>
              <div className="mb-3.5">
                <h3 className={sectionHeadClass}>{isEdit ? 'Status' : 'Notes'}</h3>
                <p className={sectionNoteClass}>
                  {isEdit
                    ? 'Both take effect the moment this is saved.'
                    : 'A new supplier starts pending and active — its onboarding is worked from the supplier itself.'}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {isEdit && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelClass}>Onboarding status</label>
                      <Controller
                        name="onboardingStatus"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value ?? 'pending'}
                            onChange={(value) =>
                              field.onChange(value as CreateSupplierFormValues['onboardingStatus'])
                            }
                            options={SUPPLIER_ONBOARDING_STATUSES.map((s) => ({
                              value: s,
                              label: ONBOARDING_META[s].label,
                            }))}
                          />
                        )}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelClass}>Status</label>
                      <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                          <>
                            <Select
                              value={field.value ?? 'active'}
                              onChange={(value) =>
                                field.onChange(value as CreateSupplierFormValues['status'])
                              }
                              options={SUPPLIER_STATUSES.map((s) => ({
                                value: s,
                                label: STATUS_META[s].label,
                              }))}
                            />
                            <p className={hintClass}>{STATUS_META[field.value ?? 'active'].hint}</p>
                          </>
                        )}
                      />
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className={labelClass} htmlFor="supplier-notes">
                    Notes
                  </label>
                  <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        id="supplier-notes"
                        value={field.value ?? ''}
                        rows={3}
                        placeholder="Anything the buying team should know…"
                        className={`${errors.notes ? badFieldClass : fieldClass} resize-y`}
                      />
                    )}
                  />
                  {errors.notes && <p className={errorClass}>{errors.notes.message}</p>}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-[#e4e4e9] bg-white px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(20,20,30,.35)] md:px-6">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* On a new supplier the tally is just the empty form read back
                  at them, so it waits until they have tried to save. */}
              {!isEdit && !isSubmitted ? null : blocking.length > 0 ? (
                <>
                  <p className="text-[11.5px] font-medium text-[#b42318]">
                    {blocking.length} {blocking.length === 1 ? 'thing' : 'things'} to fix before
                    this can be saved
                  </p>
                  <p className="truncate text-[11.5px] text-[#5b5b6b]">{blocking[0]}</p>
                </>
              ) : (
                <p className="text-[11.5px] font-medium text-[#0b6644]">Ready to save</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || codeTaken}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? isEdit
                    ? 'Saving…'
                    : 'Creating…'
                  : isEdit
                    ? 'Save changes'
                    : 'Create supplier'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
