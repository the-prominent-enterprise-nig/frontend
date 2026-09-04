import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ExpenseDetail from './_components/ExpenseDetail'

export const metadata = { title: 'Expense Detail' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_READ)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <ExpenseDetail id={id} />
    </div>
  )
}
