'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CalendarDays, MapPin, Pencil, Phone, Store, UserRound } from 'lucide-react'
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

function ReadField({
  icon: Icon,
  label,
  value,
  className = '',
}: {
  icon: typeof Building2
  label: string
  value?: string | number | null
  className?: string
}) {
  return (
    <div className={`flex items-start gap-4 rounded-xl bg-zinc-50 px-4 py-4 ${className}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-prominent-purple-700 shadow-sm ring-1 ring-zinc-200">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <p
          className={`mt-0.5 text-sm ${value ? 'font-medium text-zinc-900' : 'italic text-zinc-400'}`}
        >
          {value || 'Not set'}
        </p>
      </div>
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
    address: profile?.address ?? '',
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
      address: form.address || undefined,
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
      address: profile?.address ?? '',
      fiscalYearStartMonth: profile?.fiscalYearStartMonth ?? 1,
    })
    setIsEditing(false)
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-prominent-purple-900">Company Profile</h2>
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
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700">
                Address <span className="text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Company mailing address, shown on printable documents"
                className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
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
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ReadField
            icon={Building2}
            label="Company Legal Name"
            value={profile?.companyLegalName}
          />
          <ReadField icon={Store} label="Trading Name" value={profile?.companyTradingName} />
          <ReadField icon={UserRound} label="Contact Person" value={profile?.contactPerson} />
          <ReadField icon={Phone} label="Mobile Number" value={profile?.mobileNumber} />
          <ReadField
            icon={MapPin}
            label="Address"
            value={profile?.address}
            className="sm:col-span-2"
          />
          <ReadField
            icon={CalendarDays}
            label="Fiscal Year Start"
            value={profile?.fiscalYearStartMonth ? MONTHS[profile.fiscalYearStartMonth - 1] : null}
          />
        </div>
      )}
    </section>
  )
}
