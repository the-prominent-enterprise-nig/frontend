'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import type { Vendor, VendorType } from '@/src/libs/data/AccountingData'

interface Props {
  vendor: Vendor | null
  types: VendorType[]
  onClose: () => void
  onSave: (data: Partial<Vendor>) => Promise<void> | void
}

export default function VendorFormDialog({ vendor, types, onClose, onSave }: Props) {
  const [form, setForm] = useState<Partial<Vendor>>(
    vendor ?? {
      name: '',
      type: 'SUPPLIER',
      contactPerson: '',
      contactNumber: '',
      email: '',
      address: '',
      taxIdNumber: '',
      alphanumericTaxCode: '',
      taxRate: '',
      businessType: '',
      bankAccount: '',
      visibility: true,
    }
  )
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof Vendor>(k: K, v: Vendor[K]) => setForm((p) => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
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
            {vendor ? 'Edit Vendor' : 'Add Vendor'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name *">
              <input
                required
                value={form.name ?? ''}
                onChange={(e) => set('name', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </Field>
            <Field label="Type *">
              <select
                required
                value={form.type ?? 'SUPPLIER'}
                onChange={(e) => set('type', e.target.value as VendorType)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact Person">
              <input
                value={form.contactPerson ?? ''}
                onChange={(e) => set('contactPerson', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Contact Number">
              <input
                value={form.contactNumber ?? ''}
                onChange={(e) => set('contactNumber', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="TIN">
              <input
                value={form.taxIdNumber ?? ''}
                onChange={(e) => set('taxIdNumber', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Alphanumeric Tax Code">
              <input
                value={form.alphanumericTaxCode ?? ''}
                onChange={(e) => set('alphanumericTaxCode', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Tax Rate">
              <input
                value={form.taxRate ?? ''}
                onChange={(e) => set('taxRate', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Business Type">
              <input
                value={form.businessType ?? ''}
                onChange={(e) => set('businessType', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Bank Account">
              <input
                value={form.bankAccount ?? ''}
                onChange={(e) => set('bankAccount', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Address">
            <textarea
              value={form.address ?? ''}
              onChange={(e) => set('address', e.target.value)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
