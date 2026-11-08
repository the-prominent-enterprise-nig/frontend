import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../_shared/HubTabs'
import { ElectricityList } from './_components/ElectricityList'

export const metadata = {
  title: 'Electricity | NIG Central',
  description: 'The payments recorded on Electricity / Light Expense',
}

export default async function ElectricityPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!canAny(session, [ACCOUNTING_PERMISSIONS.EXPENSE_READ])) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <ElectricityList />
    </div>
  )
}
