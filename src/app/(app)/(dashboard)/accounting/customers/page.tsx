import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../_shared/HubTabs'
import CustomersList from './_components/CustomersList'

export const metadata = {
  title: 'Customers | NIG Central',
  description: 'Manage customer records',
}

export default async function CustomersPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.CUSTOMER_READ)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense fallback={null}>
        <HubTabs hub="receivables" session={session} />
      </Suspense>
      <CustomersList session={session} />
    </div>
  )
}
