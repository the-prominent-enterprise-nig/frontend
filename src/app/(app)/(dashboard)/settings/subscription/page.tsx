import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Subscription | Prominent Enterprise',
}

function titleCase(value?: string | null): string | null {
  if (!value) return null
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-amber-100 text-amber-700',
  past_due: 'bg-red-100 text-red-700',
  suspended: 'bg-red-100 text-red-700',
  expired: 'bg-zinc-100 text-zinc-600',
  cancelled: 'bg-zinc-100 text-zinc-600',
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-900">{String(value)}</p>
    </div>
  )
}

export default async function SubscriptionSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const subscription = session.enterpriseOwner?.activeSubscription
  const planLabel = titleCase(subscription?.planCode)
  const statusLabel = titleCase(subscription?.status)
  const statusStyle = STATUS_STYLES[subscription?.status ?? ''] ?? 'bg-zinc-100 text-zinc-600'

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Subscription &amp; Plan</h1>
          <p className="mt-1 text-sm text-zinc-500">Your current plan and entitlement details.</p>
        </div>

        {subscription ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-prominent-orange-600">
                  Current Plan
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">
                  {planLabel ?? 'No plan assigned'}
                </p>
              </div>
              {statusLabel && (
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}
                >
                  {statusLabel}
                </span>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-zinc-100 pt-5 sm:grid-cols-3">
              <DetailRow label="Billing cycle" value={titleCase(subscription.billingCycle)} />
              <DetailRow label="User limit" value={subscription.userLimit} />
              <DetailRow label="Branch limit" value={subscription.branchLimit} />
              <DetailRow
                label="Next billing date"
                value={subscription.nextBillingDate?.slice(0, 10)}
              />
            </div>

            <div className="mt-5 border-t border-zinc-100 pt-5">
              <p className="text-sm text-zinc-600">
                Subscription management is handled by your platform administrator. Contact your
                administrator to upgrade, change, or cancel your plan.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-500">
              No active subscription found. Contact your platform administrator.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Coming Soon
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900">Self-service Billing</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Subscription management, invoices, and plan upgrades will be available here in a future
            release.
          </p>
        </div>
      </div>
    </div>
  )
}
