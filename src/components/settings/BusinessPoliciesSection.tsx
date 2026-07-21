'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, ShieldCheck } from 'lucide-react'
import { updateBusinessProfile, type BusinessProfile } from '@/src/libs/actions/enterprise.actions'
import { showToast } from '@/src/components/ui/toast'

function PolicyToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-zinc-700">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? 'bg-prominent-purple-700' : 'bg-zinc-200'}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

// One card per policy toggle — add another <PolicyToggleRow> (and its field
// in `form`/save payload below) to introduce a new owner-level decision,
// whether or not it's inventory-specific.
export default function BusinessPoliciesSection({ profile }: { profile: BusinessProfile | null }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    requireHqApprovalForTransfers: profile?.requireHqApprovalForTransfers ?? false,
  })

  const isDirty =
    form.requireHqApprovalForTransfers !== (profile?.requireHqApprovalForTransfers ?? false)

  async function handleSave() {
    setSaving(true)
    const result = await updateBusinessProfile(form)
    setSaving(false)
    if (result.success) {
      showToast({
        title: 'Business policies updated',
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
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-50 text-prominent-purple-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Inventory & Transfers</h2>
          <p className="text-sm text-zinc-500">Owner-level approval and routing decisions</p>
        </div>
      </div>

      <div className="mt-5 divide-y divide-zinc-100">
        <PolicyToggleRow
          title="Require HQ approval for inter-branch transfers"
          description="When enabled, a new stock transfer request must be approved by the Business Owner before it reaches the source branch. When disabled, requests go straight to the source branch."
          checked={form.requireHqApprovalForTransfers}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, requireHqApprovalForTransfers: value }))
          }
        />
      </div>

      <div className="mt-5 flex justify-end border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-1.5 rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </section>
  )
}
