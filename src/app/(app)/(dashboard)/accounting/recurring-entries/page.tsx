import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import RecurringList from './_components/RecurringList'

export const metadata = { title: 'Recurring Entries' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.RECURRING_ENTRIES_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <RecurringList />
    </div>
  )
}
