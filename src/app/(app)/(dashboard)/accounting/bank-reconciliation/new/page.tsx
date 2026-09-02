import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import NewReconciliationForm from './_components/NewReconciliationForm'

export const metadata = { title: 'New Reconciliation' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_RECONCILE)
  return <NewReconciliationForm />
}
