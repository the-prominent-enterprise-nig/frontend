import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ExpensesList from './_components/ExpensesList'

export const metadata = { title: 'Expenses' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <ExpensesList />
    </div>
  )
}
