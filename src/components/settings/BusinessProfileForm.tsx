'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusinessProfile, type BusinessProfile } from '@/src/libs/actions/enterprise.actions'
import { showToast } from '@/src/components/ui/toast'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type Props = { profile: BusinessProfile }

export default function BusinessProfileForm({ profile }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    companyLegalName: profile.companyLegalName ?? '',
    companyTradingName: profile.companyTradingName ?? '',
    contactPerson: profile.contactPerson ?? '',
    mobileNumber: profile.mobileNumber ?? '',
    fiscalYearStartMonth: profile.fiscalYearStartMonth ?? 1,
  })
  const [saving, setSaving] = useState(false)

  const set = (field: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const result = await updateBusinessProfile({
      ...form,
      companyTradingName: form.companyTradingName || undefined,
      contactPerson: form.contactPerson || undefined,
      mobileNumber: form.mobileNumber || undefined,
    })
    setSaving(false)
    if (result.success) {
      showToast({
        title: 'Profile updated',
        description: 'Changes saved successfully.',
        status: 'success',
      })
      router.refresh()
    } else {
      showToast({
        title: 'Failed to save',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Company Details</h2>
        <p className="mt-1 text-sm text-zinc-500">Legal name and public-facing trading name.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              Company Legal Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.companyLegalName}
              onChange={(e) => set('companyLegalName', e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              placeholder="e.g. TechNova Inc."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              Trading Name <span className="text-xs font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={form.companyTradingName}
              onChange={(e) => set('companyTradingName', e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              placeholder="e.g. TechNova"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Contact Details</h2>
        <p className="mt-1 text-sm text-zinc-500">Primary contact information for the business.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Contact Person</label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) => set('contactPerson', e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              placeholder="e.g. Juan dela Cruz"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Mobile Number</label>
            <input
              type="tel"
              value={form.mobileNumber}
              onChange={(e) => set('mobileNumber', e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              placeholder="e.g. +63 917 000 0000"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Fiscal Year</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The month your financial year begins. Used for accounting reports and period calculations.
        </p>

        <div className="mt-5 max-w-xs">
          <label className="block text-sm font-medium text-zinc-700">Fiscal Year Start Month</label>
          <select
            value={form.fiscalYearStartMonth}
            onChange={(e) => set('fiscalYearStartMonth', parseInt(e.target.value, 10))}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
          >
            {MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-prominent-purple-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
