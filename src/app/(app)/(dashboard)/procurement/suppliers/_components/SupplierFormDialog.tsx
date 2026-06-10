'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  SupplierFormData,
  SupplierFormDataSchema,
  Supplier,
} from '@/src/schema/procurement/suppliers/types'
import { createSupplier } from '../_actions/create-supplier'
import { updateSupplier } from '../_actions/update-supplier'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier | null
  onSuccess?: () => void
}

const DEFAULTS: SupplierFormData = {
  code: '',
  name: '',
  legalName: '',
  taxId: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  paymentTerms: 'Net 30',
  discountTerms: '',
  currency: 'PHP',
  bankAccounts: [],
  creditLimit: null,
  onboardingStatus: 'pending',
  status: 'active',
  notes: '',
}

export function SupplierFormDialog({ open, onOpenChange, supplier, onSuccess }: Props) {
  const isEdit = Boolean(supplier)

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(SupplierFormDataSchema),
    defaultValues: DEFAULTS,
  })

  const {
    fields: bankFields,
    append: appendBank,
    remove: removeBank,
  } = useFieldArray({ control, name: 'bankAccounts' })

  useEffect(() => {
    if (!open) return
    if (supplier) {
      reset({
        code: supplier.code,
        name: supplier.name,
        legalName: supplier.legalName ?? '',
        taxId: supplier.taxId ?? '',
        contactPerson: supplier.contactPerson ?? '',
        email: supplier.email ?? '',
        phone: supplier.phone ?? '',
        address: supplier.address ?? '',
        paymentTerms: supplier.paymentTerms,
        discountTerms: supplier.discountTerms ?? '',
        currency: supplier.currency,
        bankAccounts:
          supplier.bankAccounts?.map((b) => ({
            bankName: b.bankName,
            accountNumber: b.accountNumber,
            accountName: b.accountName ?? '',
            isPrimary: b.isPrimary,
          })) ?? [],
        creditLimit: supplier.creditLimit ?? null,
        onboardingStatus: supplier.onboardingStatus,
        status: supplier.status,
        notes: supplier.notes ?? '',
      })
    } else {
      reset(DEFAULTS)
    }
  }, [open, supplier, reset])

  const onSubmit = async (data: SupplierFormData) => {
    // Strip empty strings so they don't fail email validation server-side
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === '' ? undefined : v])
    ) as SupplierFormData

    if (payload.bankAccounts && payload.bankAccounts.length > 0) {
      payload.bankAccounts = payload.bankAccounts.map((b) => ({
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountName: b.accountName === '' ? undefined : b.accountName,
        isPrimary: b.isPrimary ?? false,
      }))
    }

    const result = isEdit
      ? await updateSupplier(supplier!.id, payload)
      : await createSupplier(payload)

    if (result.success) {
      toast.success(isEdit ? 'Supplier updated' : 'Supplier created')
      onSuccess?.()
    } else {
      toast.error(result.error || result.message || 'Something went wrong')
    }
  }

  // Enforce only one bank flagged as primary at a time.
  const handlePrimaryToggle = (index: number, checked: boolean) => {
    const current = watch('bankAccounts') ?? []
    current.forEach((_, i) => {
      setValue(`bankAccounts.${i}.isPrimary`, i === index ? checked : false, {
        shouldDirty: true,
      })
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Edit Supplier' : 'New Supplier'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEdit
                ? `Update the record for ${supplier?.name}.`
                : 'Onboard a new supplier with payment terms and contact info.'}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">
            <Section title="Basic">
              <Field label="Supplier code" error={errors.code?.message} required>
                <input
                  type="text"
                  {...register('code')}
                  placeholder="SUP-0001"
                  className={inputCls(errors.code)}
                />
              </Field>
              <Field label="Name" error={errors.name?.message} required>
                <input
                  type="text"
                  {...register('name')}
                  placeholder="Acme Trading Corp."
                  className={inputCls(errors.name)}
                />
              </Field>
              <Field label="Legal name" error={errors.legalName?.message}>
                <input
                  type="text"
                  {...register('legalName')}
                  placeholder="Acme Trading Corporation"
                  className={inputCls(errors.legalName)}
                />
              </Field>
              <Field label="Tax ID / TIN" error={errors.taxId?.message}>
                <input
                  type="text"
                  {...register('taxId')}
                  placeholder="009-123-456-000"
                  className={inputCls(errors.taxId)}
                />
              </Field>
            </Section>

            <Section title="Contact">
              <Field label="Contact person" error={errors.contactPerson?.message}>
                <input
                  type="text"
                  {...register('contactPerson')}
                  className={inputCls(errors.contactPerson)}
                />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="sales@acme.com"
                  className={inputCls(errors.email)}
                />
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                <input
                  type="text"
                  {...register('phone')}
                  placeholder="+63 2 8123 4567"
                  className={inputCls(errors.phone)}
                />
              </Field>
              <Field label="Address" error={errors.address?.message} wide>
                <textarea {...register('address')} rows={2} className={inputCls(errors.address)} />
              </Field>
            </Section>

            <Section title="Terms">
              <Field label="Payment terms" error={errors.paymentTerms?.message}>
                <input
                  type="text"
                  {...register('paymentTerms')}
                  placeholder="Net 30"
                  className={inputCls(errors.paymentTerms)}
                />
              </Field>
              <Field label="Discount terms" error={errors.discountTerms?.message}>
                <input
                  type="text"
                  {...register('discountTerms')}
                  placeholder="2/10 Net 30"
                  className={inputCls(errors.discountTerms)}
                />
              </Field>
              <Field label="Currency" error={errors.currency?.message}>
                <input
                  type="text"
                  {...register('currency')}
                  placeholder="PHP"
                  maxLength={3}
                  className={inputCls(errors.currency)}
                />
              </Field>
              <Field label="Credit limit" error={errors.creditLimit?.message}>
                <input
                  type="number"
                  step="0.01"
                  {...register('creditLimit', {
                    setValueAs: (v) =>
                      v === '' || v === null || v === undefined ? null : Number(v),
                  })}
                  placeholder="500000"
                  className={inputCls(errors.creditLimit)}
                />
              </Field>
            </Section>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Banking
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    appendBank({
                      bankName: '',
                      accountNumber: '',
                      accountName: '',
                      isPrimary: bankFields.length === 0,
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add bank
                </button>
              </div>

              {bankFields.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No bank accounts yet. Click &ldquo;Add bank&rdquo; to add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {bankFields.map((field, index) => {
                    const bankErr = errors.bankAccounts?.[index]
                    return (
                      <div
                        key={field.id}
                        className="border border-gray-200 rounded-lg p-3 bg-gray-50/50"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Bank name" error={bankErr?.bankName?.message} required>
                            <input
                              type="text"
                              {...register(`bankAccounts.${index}.bankName`)}
                              placeholder="BPI"
                              className={inputCls(bankErr?.bankName)}
                            />
                          </Field>
                          <Field
                            label="Account number"
                            error={bankErr?.accountNumber?.message}
                            required
                          >
                            <input
                              type="text"
                              {...register(`bankAccounts.${index}.accountNumber`)}
                              placeholder="1234-5678-9012"
                              className={inputCls(bankErr?.accountNumber)}
                            />
                          </Field>
                          <Field label="Account name" error={bankErr?.accountName?.message} wide>
                            <input
                              type="text"
                              {...register(`bankAccounts.${index}.accountName`)}
                              placeholder="Acme Trading Corp."
                              className={inputCls(bankErr?.accountName)}
                            />
                          </Field>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <Controller
                              control={control}
                              name={`bankAccounts.${index}.isPrimary`}
                              render={({ field: cb }) => (
                                <input
                                  type="checkbox"
                                  checked={!!cb.value}
                                  onChange={(e) => handlePrimaryToggle(index, e.target.checked)}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                              )}
                            />
                            Primary
                          </label>
                          <button
                            type="button"
                            onClick={() => removeBank(index)}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Section title="Status">
              <Field label="Onboarding status" error={errors.onboardingStatus?.message}>
                <select
                  {...register('onboardingStatus')}
                  className={inputCls(errors.onboardingStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="in_review">In review</option>
                  <option value="approved">Approved</option>
                  <option value="blocked">Blocked</option>
                </select>
              </Field>
              <Field label="Status" error={errors.status?.message}>
                <select {...register('status')} className={inputCls(errors.status)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
              </Field>
              <Field label="Notes" error={errors.notes?.message} wide>
                <textarea
                  {...register('notes')}
                  rows={2}
                  placeholder="Internal notes about this supplier..."
                  className={inputCls(errors.notes)}
                />
              </Field>
            </Section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 sticky bottom-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-700 rounded-lg hover:bg-purple-800 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  error,
  required,
  wide,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function inputCls(error?: unknown) {
  return `w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
    error
      ? 'border-red-300 focus:ring-2 focus:ring-red-200 focus:border-red-500'
      : 'border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
  }`
}
