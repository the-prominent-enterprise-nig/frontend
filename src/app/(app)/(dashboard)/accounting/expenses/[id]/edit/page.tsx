import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ExpenseForm from '../../_components/ExpenseForm'

export const metadata = { title: 'Edit Expense' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_UPDATE)
  return <ExpenseForm expenseId={id} />
}
