import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import RecurringTypeForm from '../_components/RecurringTypeForm'

export const metadata = { title: 'Add to Recurring Expenses' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_CREATE)
  return <RecurringTypeForm />
}
