'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2, Building2, Landmark } from 'lucide-react'
import {
  CreateSupplierFormSchema,
  SUPPLIER_ONBOARDING_STATUSES,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  type CreateSupplierFormValues,
  type SupplierDetail,
} from '@/src/schema/inventory/suppliers'

type AccountOption = { id: string; name: string; number?: string }

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  initialData?: SupplierDetail | null
  accountOptions?: AccountOption[]
  onClose: () => void
  onSubmit: (data: CreateSupplierFormValues) => Promise<void>
  isSubmitting?: boolean
}

const EMPTY_DEFAULTS: CreateSupplierFormValues = {
  code: '',
  name: '',
  legalName: undefined,
  taxId: undefined,
  contactPerson: undefined,
  email: undefined,
  phone: undefined,
  address: undefined,
  paymentTerms: undefined,
  discountTerms: undefined,
  currency: 'PHP',
  bankAccounts: [],
  creditLimit: undefined,
  onboardingStatus: undefined,
  status: undefined,
  notes: undefined,
  type: undefined,
  businessType: undefined,
  alphanumericTaxCode: undefined,
  taxRate: undefined,
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
    bankAccounts: (supplier.bankAccounts ?? []).map((acc) => ({
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      accountName: acc.accountName ?? undefined,
      isPrimary: acc.isPrimary,
    })),
    creditLimit: supplier.creditLimit ?? undefined,
    onboardingStatus: supplier.onboardingStatus,
    status: supplier.status,
    notes: supplier.notes ?? undefined,
    type: supplier.type,
    businessType: supplier.businessType ?? undefined,
    alphanumericTaxCode: supplier.alphanumericTaxCode ?? undefined,
    taxRate: supplier.taxRate ?? undefined,
    defaultPayableAccountId: supplier.defaultPayableAccountId ?? undefined,
    defaultExpenseAccountId: supplier.defaultExpenseAccountId ?? undefined,
  }
}

const TYPE_LABELS: Record<(typeof SUPPLIER_TYPES)[number], string> = {
  SUPPLIER: 'Supplier',
  CONTRACTOR: 'Contractor',
  CONSULTANT: 'Consultant',
  OFFICER: 'Officer',
  EMPLOYEE: 'Employee',
  CONSTRUCTION: 'Construction',
  FOUNDER: 'Founder',
  OTHER: 'Other',
}

const ONBOARDING_LABELS: Record<(typeof SUPPLIER_ONBOARDING_STATUSES)[number], string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  blocked: 'Blocked',
}

const STATUS_LABELS: Record<(typeof SUPPLIER_STATUSES)[number], string> = {
  active: 'Active',
  inactive: 'Inactive',
  blacklisted: 'Blacklisted',
}

export function SupplierFormModal({
  open,
  mode,
  initialData,
  accountOptions = [],
  onClose,
  onSubmit,
  isSubmitting,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
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
    reset(mode === 'edit' && initialData ? toFormValues(initialData) : EMPTY_DEFAULTS)
  }, [open, mode, initialData, reset])

  async function handleFormSubmit(data: CreateSupplierFormValues) {
    await onSubmit(data)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-prominent-purple-600" />
            <h2 className="text-lg font-semibold text-zinc-900">
              {mode === 'edit' ? 'Edit Supplier' : 'New Supplier'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Code + Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Supplier Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. SUP-0001"
                  {...register('code')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Trading Corp."
                  {...register('name')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>
            </div>

            {/* Legal Name + Tax ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Legal Name</label>
                <input
                  type="text"
                  {...register('legalName')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.legalName && (
                  <p className="mt-1 text-xs text-red-500">{errors.legalName.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tax ID</label>
                <input
                  type="text"
                  {...register('taxId')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.taxId && (
                  <p className="mt-1 text-xs text-red-500">{errors.taxId.message}</p>
                )}
              </div>
            </div>

            {/* Type + Business Type — Scenario 33: a Supplier row can now stand
                in for any AP payee, not just an inventory supplier. */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Type</label>
                <select
                  {...register('type')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="">Default (Supplier)</option>
                  {SUPPLIER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Business Type
                </label>
                <input
                  type="text"
                  placeholder="e.g. Corporation"
                  {...register('businessType')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.businessType && (
                  <p className="mt-1 text-xs text-red-500">{errors.businessType.message}</p>
                )}
              </div>
            </div>

            {/* Tax Code + Tax Rate */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tax Code</label>
                <input
                  type="text"
                  placeholder="e.g. VAT, NON-VAT"
                  {...register('alphanumericTaxCode')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.alphanumericTaxCode && (
                  <p className="mt-1 text-xs text-red-500">{errors.alphanumericTaxCode.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tax Rate</label>
                <input
                  type="text"
                  placeholder="e.g. 12%, Exempt"
                  {...register('taxRate')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.taxRate && (
                  <p className="mt-1 text-xs text-red-500">{errors.taxRate.message}</p>
                )}
              </div>
            </div>

            {/* Contact Person + Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Contact Person
                </label>
                <input
                  type="text"
                  {...register('contactPerson')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.contactPerson && (
                  <p className="mt-1 text-xs text-red-500">{errors.contactPerson.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Phone + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Phone</label>
                <input
                  type="text"
                  {...register('phone')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Currency</label>
                <input
                  type="text"
                  placeholder="PHP"
                  maxLength={3}
                  {...register('currency')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.currency && (
                  <p className="mt-1 text-xs text-red-500">{errors.currency.message}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Address</label>
              <textarea
                rows={2}
                {...register('address')}
                className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
              />
              {errors.address && (
                <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
              )}
            </div>

            {/* Payment Terms + Discount Terms */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Payment Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Net 30"
                  {...register('paymentTerms')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.paymentTerms && (
                  <p className="mt-1 text-xs text-red-500">{errors.paymentTerms.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Discount Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2/10 Net 30"
                  {...register('discountTerms')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.discountTerms && (
                  <p className="mt-1 text-xs text-red-500">{errors.discountTerms.message}</p>
                )}
              </div>
            </div>

            {/* Credit Limit + Onboarding Status + Status */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Credit Limit</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  {...register('creditLimit', {
                    // A blank input becomes NaN under valueAsNumber, which
                    // z.number().optional() doesn't treat as absent — coerce
                    // it to undefined so leaving this field blank validates.
                    setValueAs: (v) => (v === '' ? undefined : Number(v)),
                  })}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {errors.creditLimit && (
                  <p className="mt-1 text-xs text-red-500">{errors.creditLimit.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Onboarding Status
                </label>
                <select
                  {...register('onboardingStatus')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="">Default</option>
                  {SUPPLIER_ONBOARDING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ONBOARDING_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
                <select
                  {...register('status')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="">Default</option>
                  {SUPPLIER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Default GL Accounts — Scenario 33, merged in from Vendor. Routes
                this supplier's AP bills to their own accounts instead of the
                shared AP_PAYABLE/DEFAULT_EXPENSE mappings. */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Default AP Payable Account
                </label>
                <select
                  {...register('defaultPayableAccountId')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="">Use default mapping</option>
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number ? `${a.number} — ${a.name}` : a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Default Expense Account
                </label>
                <select
                  {...register('defaultExpenseAccountId')}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="">Use default mapping</option>
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number ? `${a.number} — ${a.name}` : a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bank Accounts */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                  <Landmark className="h-4 w-4 text-zinc-400" />
                  Bank Accounts
                </label>
                <button
                  type="button"
                  onClick={() =>
                    append({
                      bankName: '',
                      accountNumber: '',
                      accountName: undefined,
                      isPrimary: false,
                    })
                  }
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Bank Account
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid flex-1 grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600">
                            Bank Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            {...register(`bankAccounts.${index}.bankName`)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                          />
                          {errors.bankAccounts?.[index]?.bankName && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.bankAccounts[index]?.bankName?.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600">
                            Account Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            {...register(`bankAccounts.${index}.accountNumber`)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                          />
                          {errors.bankAccounts?.[index]?.accountNumber && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.bankAccounts[index]?.accountNumber?.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="mt-5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Account Name
                        </label>
                        <input
                          type="text"
                          {...register(`bankAccounts.${index}.accountName`)}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      </div>
                      <label className="mt-5 flex items-center gap-2 text-xs font-medium text-zinc-600">
                        <input
                          type="checkbox"
                          {...register(`bankAccounts.${index}.isPrimary`)}
                          className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-600 focus:ring-prominent-purple-500"
                        />
                        Primary account
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <textarea
                rows={2}
                {...register('notes')}
                className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
              />
              {errors.notes && <p className="mt-1 text-xs text-red-500">{errors.notes.message}</p>}
            </div>
          </div>

          {/* Footer */}
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
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting
                ? mode === 'edit'
                  ? 'Saving…'
                  : 'Creating…'
                : mode === 'edit'
                  ? 'Save Changes'
                  : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
