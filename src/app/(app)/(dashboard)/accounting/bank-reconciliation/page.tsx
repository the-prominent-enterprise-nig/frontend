import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../_shared/HubTabs'
import BankRecon from './_components/BankRecon'

export const metadata = { title: 'Bank Reconciliation' }
export default async function Page() {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ
  )
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={null}>
        <HubTabs hub="cash-banking" session={session} />
      </Suspense>
      <BankRecon
        canReconcile={can(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_RECONCILE)}
        canAdjust={can(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_ADJUST)}
      />
    </div>
  )
}
