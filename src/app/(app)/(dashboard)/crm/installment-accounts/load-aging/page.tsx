import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import AgingLoadView from './_components/AgingLoadView'

export const metadata = { title: 'Load AR Aging | CRM' }

export default async function LoadAgingPage() {
  // Matches the backend route's OR permission: the Accountant holds only the
  // accounting one, a Branch Manager only the CRM one.
  requirePermission(await getSessionOrNull(), [
    CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_CREATE,
    ACCOUNTING_PERMISSIONS.AR_INVOICES_CREATE,
  ])
  return (
    <div className="min-h-screen bg-gray-50">
      <AgingLoadView />
    </div>
  )
}
