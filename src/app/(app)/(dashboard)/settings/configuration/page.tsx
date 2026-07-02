import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import type { SessionUser } from '@/src/libs/guards/permission'
import { getOwnerPaymentMethods } from './_actions/owner-payment-methods'
import { getCashierPinStatus } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { ConfigurationTabs } from './_components/ConfigurationTabs'

export const metadata = { title: 'Configuration | Prominent Enterprise' }

function canAccess(user: SessionUser): boolean {
  if (isAdmin(user)) return true
  const allRoles = [user.primaryRole ?? '', ...user.roles]
  return allRoles.some((r) => r === 'Branch Manager' || r === 'pos-manager')
}

export default async function ConfigurationPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canAccess(session)) redirect('/403')

  const [paymentMethodsResult, pinStatusResult] = await Promise.all([
    getOwnerPaymentMethods(),
    getCashierPinStatus(),
  ])

  return (
    <div className="px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Global settings that apply across your business.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <ConfigurationTabs
          initialPaymentMethods={paymentMethodsResult.data ?? []}
          initialHasPin={pinStatusResult.data?.hasPin ?? false}
        />
      </div>
    </div>
  )
}
