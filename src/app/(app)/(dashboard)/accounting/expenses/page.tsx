import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../_shared/HubTabs'
import ExpensesList from './_components/ExpensesList'

export const metadata = { title: 'Expenses' }
export default async function Page() {
  const session = requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.EXPENSE_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <ExpensesList />
    </div>
  )
}
