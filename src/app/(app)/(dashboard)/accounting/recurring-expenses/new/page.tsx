import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ExpenseForm from '../../expenses/_components/ExpenseForm'

export const metadata = { title: 'New Recurring Expense' }
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_CREATE)
  // `?from=<expense id>` opens the form already filled in from that expense
  // ("Make recurring" on an expense); only the schedule is left to say.
  return <ExpenseForm recurring={{ fromExpenseId: from }} />
}
