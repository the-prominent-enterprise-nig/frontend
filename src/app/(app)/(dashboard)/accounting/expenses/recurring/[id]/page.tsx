import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../../../_shared/HubTabs'
import RecurringTypeAmounts from '../_components/RecurringTypeAmounts'

export const metadata = { title: 'Recurring Expense' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.RECURRING_EXPENSES_READ
  )
  return (
    <>
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <RecurringTypeAmounts id={id} session={session} />
    </>
  )
}
