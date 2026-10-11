import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import RecurringExpensesList from './_components/RecurringExpensesList'

export const metadata = { title: 'Recurring Expenses' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_READ)
  return <RecurringExpensesList />
}
