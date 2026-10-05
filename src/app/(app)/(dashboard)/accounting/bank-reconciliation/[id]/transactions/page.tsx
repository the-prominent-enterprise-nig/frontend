import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { ReconciliationTransactionsPage } from '../_components/ReconciliationSubPages'

export const metadata = { title: 'Reconciliation Transactions' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_RECONCILE)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <ReconciliationTransactionsPage id={id} />
    </div>
  )
}
