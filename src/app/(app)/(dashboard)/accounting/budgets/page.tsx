import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import BudgetsList from './_components/BudgetsList'

export const metadata = { title: 'Budgets' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.BUDGET_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <BudgetsList />
    </div>
  )
}
