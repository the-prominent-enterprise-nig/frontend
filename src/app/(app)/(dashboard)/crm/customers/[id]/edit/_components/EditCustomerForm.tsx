'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import { updateCustomerSchema, type UpdateCustomerInput } from '@/src/schema/crm/customer'
import type { CustomerType, CustomerStatus, CustomerSourceChannel } from '@/src/schema/crm/types'

type FormState = {
  customerCode: string
  name: string
  customerType: CustomerType
  companyName: string
  taxId: string
  isTaxExempt: boolean
  taxExemptionRef: string
  email: string
  phone: string
  billingAddress: string
  shippingAddress: string
  paymentTerms: string
  creditLimit: string
  sourceChannel: CustomerSourceChannel
  status: CustomerStatus
  notes: string
}

const empty: FormState = {
  customerCode: '',
  name: '',
  customerType: 'individual',
  companyName: '',
  taxId: '',
  isTaxExempt: false,
  taxExemptionRef: '',
  email: '',
  phone: '',
  billingAddress: '',
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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    customersApi.get(id).then((res) => {
      if (res.success && res.data) {
        const c = res.data
        setForm({
          customerCode: c.customerCode,
          name: c.name,
          customerType: c.customerType,
          companyName: c.companyName ?? '',
          taxId: c.taxId ?? '',
          isTaxExempt: c.isTaxExempt,
          taxExemptionRef: c.taxExemptionRef ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          billingAddress: c.billingAddress ?? '',
          shippingAddress: c.shippingAddress ?? '',
          paymentTerms: c.paymentTerms ?? '',
          creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
          sourceChannel: c.sourceChannel,
          status: c.status,
          notes: c.notes ?? '',
        })
      } else {
        setServerError(res.error ?? 'Customer not found')
      }
      setLoading(false)
    })
  }, [id])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // Strip empty strings — let the backend keep existing values for blanks.
    const payload: UpdateCustomerInput = {
      customerCode: form.customerCode,
      name: form.name,
      customerType: form.customerType,
      companyName: form.companyName || undefined,
      taxId: form.taxId || undefined,
      isTaxExempt: form.isTaxExempt,
      taxExemptionRef: form.taxExemptionRef || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      billingAddress: form.billingAddress || undefined,
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
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Customer code *"
            error={errors.customerCode}
            value={form.customerCode}
            onChange={(v) => setField('customerCode', v)}
          />
          <Field
            label="Name *"
            error={errors.name}
            value={form.name}
            onChange={(v) => setField('name', v)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Type</label>
            <select
              value={form.customerType}
              onChange={(e) => setField('customerType', e.target.value as CustomerType)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </div>
          <Field
            label="Company name"
            value={form.companyName}
            onChange={(v) => setField('companyName', v)}
          />
        </div>

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
          <label className="block text-[13px] font-medium text-gray-700">Billing address</label>
          <textarea
            rows={2}
            value={form.billingAddress}
            onChange={(e) => setField('billingAddress', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Shipping address</label>
          <textarea
            rows={2}
            value={form.shippingAddress}
            onChange={(e) => setField('shippingAddress', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Tax ID" value={form.taxId} onChange={(v) => setField('taxId', v)} />
          <div className="flex items-end gap-2 pb-2">
            <input
              id="isTaxExempt"
              type="checkbox"
              checked={form.isTaxExempt}
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
          <Field
            label="Payment terms"
            value={form.paymentTerms}
            onChange={(v) => setField('paymentTerms', v)}
          />
          <Field
            label="Credit limit (₱)"
            value={form.creditLimit}
            onChange={(v) => setField('creditLimit', v)}
          />
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Status</label>
            <select
              value={form.status}
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
            value={form.sourceChannel}
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
            disabled={submitting}
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
      />
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
