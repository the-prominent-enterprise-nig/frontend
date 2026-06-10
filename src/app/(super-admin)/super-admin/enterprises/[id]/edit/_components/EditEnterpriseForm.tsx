'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Enterprise {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
  contactPerson?: string | null
  mobileNumber?: string | null
  industry: string
  country: string
  timezone?: string | null
}

const INDUSTRIES = [
  'Retail',
  'Food & Beverage',
  'Healthcare',
  'Technology',
  'Manufacturing',
  'Education',
  'Finance',
  'Real Estate',
  'Transportation',
  'Hospitality',
  'Construction',
  'Other',
]

const inputCls =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'

export function EditEnterpriseForm({ enterprise }: { enterprise: Enterprise }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    companyLegalName: enterprise.companyLegalName,
    companyTradingName: enterprise.companyTradingName ?? '',
    contactPerson: enterprise.contactPerson ?? '',
    mobileNumber: enterprise.mobileNumber ?? '',
    industry: enterprise.industry,
    country: enterprise.country,
    timezone: enterprise.timezone ?? '',
  })

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    if (!form.companyLegalName.trim()) {
      toast.error('Legal name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/enterprises/${enterprise.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to update')
      }
      toast.success('Business updated')
      router.push(`/super-admin/enterprises/${enterprise.id}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Legal Business Name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.companyLegalName}
            onChange={(e) => set('companyLegalName', e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Trading / Brand Name
          </label>
          <input
            value={form.companyTradingName}
            onChange={(e) => set('companyTradingName', e.target.value)}
            className={inputCls}
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Industry</label>
          <select
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
            className={inputCls}
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Country (ISO 2)</label>
          <input
            value={form.country}
            onChange={(e) => set('country', e.target.value.toUpperCase().slice(0, 2))}
            className={inputCls}
            maxLength={2}
            placeholder="PH"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Timezone</label>
          <input
            value={form.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            className={inputCls}
            placeholder="Asia/Manila"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Contact Person</label>
          <input
            value={form.contactPerson}
            onChange={(e) => set('contactPerson', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Mobile Number</label>
          <input
            value={form.mobileNumber}
            onChange={(e) => set('mobileNumber', e.target.value)}
            className={inputCls}
            placeholder="+63 9xx xxx xxxx"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={() => router.back()}
          disabled={saving}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
