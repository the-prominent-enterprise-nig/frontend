import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/src/libs/guards/permission'
import { getBusinessProfile } from '@/src/libs/actions/enterprise.actions'
import BusinessPoliciesSection from '@/src/components/settings/BusinessPoliciesSection'

export const metadata = {
  title: 'Business Policies | Prominent Enterprise',
}

// One page for cross-module, owner-level decisions — each module's policies
// get their own section component here (BusinessPoliciesSection today is
// Inventory & Transfers-only; add a sibling section per module as more
// owner-level toggles come up, rather than scattering them across each
// module's own settings page).
export default async function BusinessPoliciesPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const profileResult = await getBusinessProfile()

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-zinc-900">Business Policies</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Owner-level decisions that govern how requests and approvals flow across modules.
          </p>
        </div>
        <BusinessPoliciesSection
          profile={profileResult.success ? (profileResult.data ?? null) : null}
        />
      </div>
    </div>
  )
}
