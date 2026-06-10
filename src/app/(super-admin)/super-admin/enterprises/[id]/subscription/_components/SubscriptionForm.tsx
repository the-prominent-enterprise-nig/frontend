'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Plan {
  code: string
  label: string
}

interface Subscription {
  planCode: string
  status: string
  billingCycle: string
  userLimit: number
  branchLimit: number
  amount?: string
  currency?: string
  nextBillingDate?: string | null
  startDate?: string | null
  expirationDate?: string | null
  trialEndsAt?: string | null
}

interface Props {
  enterpriseId: string
  subscription: Subscription | null
}

const STATUSES = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
]

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
]

const inputCls =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'

const labelCls = 'mb-1 block text-xs font-medium text-zinc-500'

export function SubscriptionForm({ enterpriseId, subscription }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then((r) => r.json())
      .then((data: Plan[]) => setPlans(data))
      .catch(() => {})
  }, [])
  const [form, setForm] = useState({
    planCode: subscription?.planCode ?? 'trial',
    status: subscription?.status ?? 'trial',
    billingCycle: subscription?.billingCycle ?? 'monthly',
    userLimit: subscription?.userLimit ?? 10,
    branchLimit: subscription?.branchLimit ?? 3,
    trialEndsAt: subscription?.trialEndsAt?.slice(0, 10) ?? '',
    expirationDate: subscription?.expirationDate?.slice(0, 10) ?? '',
    nextBillingDate: subscription?.nextBillingDate?.slice(0, 10) ?? '',
  })

  function set(key: keyof typeof form, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        planCode: form.planCode,
        status: form.status,
        billingCycle: form.billingCycle,
        userLimit: Number(form.userLimit),
        branchLimit: Number(form.branchLimit),
      }
      if (form.trialEndsAt) body.trialEndsAt = form.trialEndsAt
      if (form.expirationDate) body.expirationDate = form.expirationDate
      if (form.nextBillingDate) body.nextBillingDate = form.nextBillingDate

      const res = await fetch(`/api/super-admin/enterprises/${enterpriseId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to update subscription')
      }
      toast.success('Subscription updated')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Plan</label>
          <select
            value={form.planCode}
            onChange={(e) => set('planCode', e.target.value)}
            className={inputCls}
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Billing Cycle</label>
          <select
            value={form.billingCycle}
            onChange={(e) => set('billingCycle', e.target.value)}
            className={inputCls}
          >
            {BILLING_CYCLES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>User Limit</label>
          <input
            type="number"
            min={1}
            value={form.userLimit}
            onChange={(e) => set('userLimit', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Branch Limit</label>
          <input
            type="number"
            min={1}
            value={form.branchLimit}
            onChange={(e) => set('branchLimit', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Trial Ends At</label>
          <input
            type="date"
            value={form.trialEndsAt}
            onChange={(e) => set('trialEndsAt', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Expiration Date</label>
          <input
            type="date"
            value={form.expirationDate}
            onChange={(e) => set('expirationDate', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Next Billing Date</label>
          <input
            type="date"
            value={form.nextBillingDate}
            onChange={(e) => set('nextBillingDate', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Subscription'}
        </button>
      </div>
    </div>
  )
}
