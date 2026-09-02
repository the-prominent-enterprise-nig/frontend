import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ReconciliationWorksheet from './_components/ReconciliationWorksheet'

export const metadata = { title: 'Reconciliation Worksheet' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_RECONCILE)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <ReconciliationWorksheet id={id} />
    </div>
  )
}
