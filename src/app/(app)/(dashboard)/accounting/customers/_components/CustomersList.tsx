'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, RefreshCw, Pencil, Trash2, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  Customer,
  CustomerInput,
} from '@/src/libs/data/AccountingData'
import { SessionUser, can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

const FIELD_LIMITS = {
  firstName: 150,
  lastName: 150,
  email: 255,
  phoneNumber: 50,
  address: 1000,
  note: 1000,
} as const

interface Props {
  session: SessionUser
}

export default function CustomersList({ session }: Props) {
  const [items, setItems] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  const canCreate = can(session, ACCOUNTING_PERMISSIONS.CUSTOMER_CREATE)
  const canUpdate = can(session, ACCOUNTING_PERMISSIONS.CUSTOMER_UPDATE)
  const canDelete = can(session, ACCOUNTING_PERMISSIONS.CUSTOMER_DELETE)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getCustomers({ search })
    if (res.success && res.data) {
      const list = Array.isArray(res.data)
        ? res.data
        : ((res.data as { items: Customer[] }).items ?? [])
      setItems(list)
    }
    setLoading(false)
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (data: Partial<CustomerInput>) => {
    const res = editing ? await updateCustomer(editing.id, data) : await createCustomer(data)
    if (!res.success) {
      toast.error(res.message || res.error || 'Could not save customer')
      return
    }
    toast.success(editing ? 'Customer updated' : 'Customer created')
    setDialogOpen(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"?`)) return
    const res = await deleteCustomer(c.id)
    if (!res.success) {
      toast.error(res.message || res.error || 'Could not delete customer')
      return
    }
    toast.success('Customer deleted')
    load()
  }

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Customers</h2>
            <p className="text-sm text-gray-500 mt-1">Manage customer master records</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {canCreate && (
              <button
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                <Plus className="h-4 w-4" /> Add Customer
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Code
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Email / Phone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Address
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  items.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {c.customerCode || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {c.name}
                        <span className="ml-2 text-xs font-normal capitalize text-zinc-400">
                          {c.customerType ?? 'individual'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-zinc-700">{c.email || '-'}</div>
                        <div className="text-xs text-zinc-500">{c.phone || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{c.billingAddress || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/accounting/reports?tab=customer-statement&customerId=${c.id}`}
                            title="View statement — open balance and payment history"
                            className="p-1.5 text-purple-700 hover:bg-purple-50 rounded"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>
                          {canUpdate && (
                            <button
                              onClick={() => {
                                setEditing(c)
                                setDialogOpen(true)
                              }}
                              className="p-1.5 text-purple-700 hover:bg-purple-50 rounded"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(c)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <CustomerFormDialog
          customer={editing}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function customerToFormInput(customer: Customer | null): Partial<CustomerInput> {
  if (!customer) {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      address: '',
      note: '',
      customerType: 'individual',
    }
  }
  // `name` is stored as a single field — split naively for the two-field
  // form (mirrors the same split the backend does when merging partial
  // firstName/lastName updates back onto the stored name).
  const [firstName, ...rest] = (customer.name ?? '').split(' ')
  return {
    firstName: firstName ?? '',
    lastName: rest.join(' '),
    email: customer.email ?? '',
    phoneNumber: customer.phone ?? '',
    address: customer.billingAddress ?? '',
    note: customer.notes ?? '',
    customerType: customer.customerType ?? 'individual',
  }
}

function CustomerFormDialog({
  customer,
  onClose,
  onSave,
}: {
  customer: Customer | null
  onClose: () => void
  onSave: (data: Partial<CustomerInput>) => Promise<void> | void
}) {
  const [form, setForm] = useState<Partial<CustomerInput>>(customerToFormInput(customer))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ email?: string }>({})
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (k === 'email') setErrors((p) => ({ ...p, email: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email?.trim()) {
      setErrors({ email: 'Email is required' })
      toast.error('Email is required')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {customer ? 'Edit Customer' : 'Add Customer'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <Field label="Customer Type">
            <select
              value={form.customerType ?? 'individual'}
              onChange={(e) => set('customerType', e.target.value as CustomerInput['customerType'])}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="individual">Individual</option>
              <option value="business">Business</option>
              <option value="employee">Employee</option>
            </select>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="First Name *"
              count={[form.firstName?.length ?? 0, FIELD_LIMITS.firstName]}
            >
              <input
                required
                maxLength={FIELD_LIMITS.firstName}
                value={form.firstName ?? ''}
                onChange={(e) => set('firstName', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Last Name *" count={[form.lastName?.length ?? 0, FIELD_LIMITS.lastName]}>
              <input
                required
                maxLength={FIELD_LIMITS.lastName}
                value={form.lastName ?? ''}
                onChange={(e) => set('lastName', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field
              label="Email *"
              count={[form.email?.length ?? 0, FIELD_LIMITS.email]}
              error={errors.email}
            >
              <input
                type="email"
                required
                maxLength={FIELD_LIMITS.email}
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${
                  errors.email
                    ? 'border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300'
                    : 'border-zinc-200'
                }`}
              />
            </Field>
            <Field
              label="Phone Number"
              count={[form.phoneNumber?.length ?? 0, FIELD_LIMITS.phoneNumber]}
            >
              <input
                maxLength={FIELD_LIMITS.phoneNumber}
                value={form.phoneNumber ?? ''}
                onChange={(e) => set('phoneNumber', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Address" count={[form.address?.length ?? 0, FIELD_LIMITS.address]}>
            <textarea
              maxLength={FIELD_LIMITS.address}
              value={form.address ?? ''}
              onChange={(e) => set('address', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Note" count={[form.note?.length ?? 0, FIELD_LIMITS.note]}>
            <textarea
              maxLength={FIELD_LIMITS.note}
              value={form.note ?? ''}
              onChange={(e) => set('note', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  count,
  error,
  children,
}: {
  label: string
  count?: [length: number, limit: number]
  error?: string
  children: React.ReactNode
}) {
  const atLimit = count ? count[0] >= count[1] : false
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600">{label}</span>
        {count && (
          <span className={`text-[11px] ${atLimit ? 'font-medium text-red-500' : 'text-zinc-400'}`}>
            {count[0]}/{count[1]}
          </span>
        )}
      </span>
      {children}
      {atLimit && (
        <span className="mt-1 block text-[11px] text-red-500">Maximum length reached</span>
      )}
      {error && <span className="mt-1 block text-[11px] text-red-500">{error}</span>}
    </label>
  )
}
