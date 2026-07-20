'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { customersApi } from '@/src/libs/api/crm'
import {
  createCustomerSchema,
  PAYMENT_TERMS_OPTIONS,
  type CreateCustomerInput,
} from '@/src/schema/crm/customer'
import type { CustomerType } from '@/src/schema/crm/types'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'

type FormState = {
  firstName: string
  lastName: string
  customerType: CustomerType
  companyName: string
  taxId: string
  isTaxExempt: boolean
  taxExemptionRef: string
  email: string
  phone: string
  shippingAddress: string
  paymentTerms: string
  creditLimit: string
  notes: string
}

const empty: FormState = {
  firstName: '',
  lastName: '',
  customerType: 'individual',
  companyName: '',
  taxId: '',
  isTaxExempt: false,
  taxExemptionRef: '',
  email: '',
  phone: '',
  shippingAddress: '',
  paymentTerms: '',
  creditLimit: '',
  notes: '',
}

export default function NewCustomerForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const name = `${form.firstName} ${form.lastName}`.trim()
    const payload: CreateCustomerInput = {
      name,
      customerType: form.customerType,
      companyName: form.customerType === 'business' ? form.companyName || undefined : undefined,
      taxId: form.taxId || undefined,
      isTaxExempt: form.isTaxExempt,
      taxExemptionRef: form.taxExemptionRef || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      shippingAddress: form.shippingAddress || undefined,
      paymentTerms: form.paymentTerms || undefined,
      creditLimit: form.creditLimit === '' ? undefined : Number(form.creditLimit),
      // Fixed, not user-selectable — this form is a direct manual add under CRM.
      sourceChannel: 'sales',
      notes: form.notes || undefined,
    }

    const parsed = createCustomerSchema.safeParse(payload)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message
      })
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    const res = await customersApi.create(parsed.data)
    setSubmitting(false)
    if (res.success && res.data) {
      router.push(`/crm/customers/${res.data.id}`)
      router.refresh()
    } else {
      setServerError(res.error ?? 'Failed to create customer')
    }
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/crm/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">New Customer</h1>
      <p className="mt-1 text-sm text-gray-500">Create a customer profile — no sale required.</p>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="First name *"
            value={form.firstName}
            maxLength={120}
            onChange={(v) => setField('firstName', v)}
          />
          <Field
            label="Last name *"
            value={form.lastName}
            maxLength={120}
            onChange={(v) => setField('lastName', v)}
          />
        </div>
        {errors.name && <p className="-mt-3 text-[12px] text-red-600">{errors.name}</p>}

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Type</label>
          <select
            value={form.customerType ?? 'individual'}
            onChange={(e) => setField('customerType', e.target.value as CustomerType)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </select>
        </div>

        {form.customerType === 'business' && (
          <Field
            label="Company name"
            value={form.companyName}
            maxLength={255}
            onChange={(v) => setField('companyName', v)}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            error={errors.email}
            value={form.email}
            maxLength={255}
            type="email"
            onChange={(v) => setField('email', v)}
          />
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Phone</label>
            <PhoneInput
              value={form.phone ?? ''}
              defaultCountry="PH"
              international
              countryCallingCodeEditable={false}
              onChange={(v) => setField('phone', v ?? '')}
              numberInputProps={{ className: 'phone-input-field' }}
              className="ph-phone-input mt-1"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-gray-700">
            Shipping address
          </label>
          <PhilippineAddressPicker onChange={(v) => setField('shippingAddress', v)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Tax ID"
            value={form.taxId}
            maxLength={50}
            onChange={(v) => setField('taxId', v)}
          />
          <div className="flex items-end gap-2 pb-2">
            <input
              id="isTaxExempt"
              type="checkbox"
              checked={form.isTaxExempt ?? false}
              onChange={(e) => setField('isTaxExempt', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isTaxExempt" className="text-[13px] font-medium text-gray-700">
              Tax-exempt
            </label>
          </div>
          <Field
            label="Exemption ref"
            value={form.taxExemptionRef}
            maxLength={100}
            onChange={(v) => setField('taxExemptionRef', v)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Payment terms</label>
            <select
              value={form.paymentTerms ?? ''}
              onChange={(e) => setField('paymentTerms', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select payment terms</option>
              {PAYMENT_TERMS_OPTIONS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Credit limit (₱)"
            value={form.creditLimit}
            max={999_999_999}
            type="number"
            onChange={(v) => setField('creditLimit', v)}
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={form.notes ?? ''}
            maxLength={1000}
            onChange={(e) => setField('notes', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/crm/customers"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create customer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
  maxLength,
  max,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  maxLength?: number
  max?: number
  type?: string
}) {
  // Derived, stable id — also lets tests target fields via getByLabel()
  // instead of brittle selectors, since label/input weren't otherwise linked.
  const id = `field-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        maxLength={maxLength}
        max={max}
        min={type === 'number' ? 0 : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
      />
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
