'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Pencil } from 'lucide-react'
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

function ReadField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-900">{value ?? '—'}</p>
    </div>
  )
}

export default function CompanyProfileSection({ profile }: { profile: BusinessProfile | null }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    companyLegalName: profile?.companyLegalName ?? '',
    companyTradingName: profile?.companyTradingName ?? '',
    contactPerson: profile?.contactPerson ?? '',
    mobileNumber: profile?.mobileNumber ?? '',
    fiscalYearStartMonth: profile?.fiscalYearStartMonth ?? 1,
  })

  const set = (field: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async (e: React.FormEvent) => {
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
      setIsEditing(false)
      router.refresh()
    } else {
      showToast({
        title: 'Failed to save',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
    }
  }

  const handleCancel = () => {
    setForm({
      companyLegalName: profile?.companyLegalName ?? '',
      companyTradingName: profile?.companyTradingName ?? '',
      contactPerson: profile?.contactPerson ?? '',
      mobileNumber: profile?.mobileNumber ?? '',
      fiscalYearStartMonth: profile?.fiscalYearStartMonth ?? 1,
    })
    setIsEditing(false)
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Company Profile</h2>
            <p className="text-sm text-zinc-500">Business name, contact details, and fiscal year</p>
          </div>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Contact Person</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) => set('contactPerson', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Mobile Number</label>
              <input
                type="tel"
                value={form.mobileNumber}
                onChange={(e) => set('mobileNumber', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Fiscal Year Start</label>
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

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ReadField label="Company Legal Name" value={profile?.companyLegalName} />
          <ReadField label="Trading Name" value={profile?.companyTradingName} />
          <ReadField label="Contact Person" value={profile?.contactPerson} />
          <ReadField label="Mobile Number" value={profile?.mobileNumber} />
          <ReadField
            label="Fiscal Year Start"
            value={profile?.fiscalYearStartMonth ? MONTHS[profile.fiscalYearStartMonth - 1] : null}
          />
        </div>
      )}
    </section>
  )
}
