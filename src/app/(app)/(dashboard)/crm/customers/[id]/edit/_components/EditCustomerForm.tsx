'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import {
  updateCustomerSchema,
  PAYMENT_TERMS_OPTIONS,
  type UpdateCustomerInput,
} from '@/src/schema/crm/customer'
import type { CustomerType, CustomerStatus, CustomerSourceChannel } from '@/src/schema/crm/types'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'

type FormState = {
  customerCode: string
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
  sourceChannel: CustomerSourceChannel
  status: CustomerStatus
  notes: string
}

const empty: FormState = {
  customerCode: '',
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
  sourceChannel: 'pos_walkin',
  status: 'active',
  notes: '',
}

export default function EditCustomerForm({ id }: { id: string }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(empty)
  const [initialForm, setInitialForm] = useState<FormState>(empty)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    customersApi.get(id).then((res) => {
      if (res.success && res.data) {
        const c = res.data
        // `name` is stored as a single field — split on the first space so
        // the form can present it the same way the create form collects it.
        const [firstName, ...lastParts] = c.name.split(' ')
        const loaded: FormState = {
          customerCode: c.customerCode,
          firstName: firstName ?? '',
          lastName: lastParts.join(' '),
          customerType: c.customerType,
          companyName: c.companyName ?? '',
          taxId: c.taxId ?? '',
          isTaxExempt: c.isTaxExempt,
          taxExemptionRef: c.taxExemptionRef ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          shippingAddress: c.shippingAddress ?? '',
          paymentTerms: c.paymentTerms ?? '',
          creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
          sourceChannel: c.sourceChannel,
          status: c.status,
          notes: c.notes ?? '',
        }
        setForm(loaded)
        setInitialForm(loaded)
      } else {
        setServerError(res.error ?? 'Customer not found')
      }
      setLoading(false)
    })
  }, [id])

  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // Strip empty strings — let the backend keep existing values for blanks.
    const payload: UpdateCustomerInput = {
      customerCode: form.customerCode,
      name: `${form.firstName} ${form.lastName}`.trim(),
      customerType: form.customerType,
      companyName: form.companyName || undefined,
      taxId: form.taxId || undefined,
      isTaxExempt: form.isTaxExempt,
      taxExemptionRef: form.taxExemptionRef || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      shippingAddress: form.shippingAddress || undefined,
      paymentTerms: form.paymentTerms || undefined,
      creditLimit: form.creditLimit === '' ? undefined : Number(form.creditLimit),
      sourceChannel: form.sourceChannel,
      status: form.status,
      notes: form.notes || undefined,
    }

    const parsed = updateCustomerSchema.safeParse(payload)
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
    const res = await customersApi.update(id, parsed.data)
    setSubmitting(false)
    if (res.success) {
      router.push(`/crm/customers/${id}`)
      router.refresh()
    } else {
      setServerError(res.error ?? 'Failed to update customer')
    }
  }

  if (loading) {
    return <div className="px-6 py-8 text-gray-400">Loading customer…</div>
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href={`/crm/customers/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customer
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">Edit Customer</h1>
      <p className="mt-1 text-sm text-gray-500">
        Update profile, billing, tax, and account status.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <Field
          label="Customer code *"
          error={errors.customerCode}
          value={form.customerCode}
          onChange={(v) => setField('customerCode', v)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="First name *"
            value={form.firstName}
            onChange={(v) => setField('firstName', v)}
          />
          <Field
            label="Last name *"
            value={form.lastName}
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
            onChange={(v) => setField('companyName', v)}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            error={errors.email}
            value={form.email}
            onChange={(v) => setField('email', v)}
          />
          <Field label="Phone" value={form.phone} onChange={(v) => setField('phone', v)} />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-gray-700">
            Shipping address
          </label>
          {form.shippingAddress && (
            <p className="mb-1.5 text-xs text-gray-500">
              Current: <span className="text-gray-700">{form.shippingAddress}</span> — pick below to
              replace it.
            </p>
          )}
          <PhilippineAddressPicker
            onChange={(v) => {
              // The picker fires '' until the user has actually picked
              // something — ignore those so the loaded value isn't wiped
              // out before the user starts editing.
              if (v) setField('shippingAddress', v)
            }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Tax ID" value={form.taxId} onChange={(v) => setField('taxId', v)} />
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
            onChange={(v) => setField('taxExemptionRef', v)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
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
            onChange={(v) => setField('creditLimit', v)}
          />
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Status</label>
            <select
              value={form.status ?? 'active'}
              onChange={(e) => setField('status', e.target.value as CustomerStatus)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Source channel</label>
          <select
            value={form.sourceChannel ?? 'pos_walkin'}
            onChange={(e) => setField('sourceChannel', e.target.value as CustomerSourceChannel)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="pos_walkin">POS Walk-in</option>
            <option value="sales">Sales</option>
            <option value="crm_lead">CRM Lead</option>
            <option value="online">Online</option>
          </select>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/crm/customers/${id}`}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !hasChanges}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save changes'}
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-gray-700">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
      />
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
