import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../../_shared/HubTabs'
import APPaymentsList from './_components/APPaymentsList'

export const metadata = { title: 'Payments' }
export default async function Page() {
  const session = requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.AP_BILLS_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={null}>
        <HubTabs hub="payables" session={session} />
      </Suspense>
      <APPaymentsList />
    </div>
  )
}
