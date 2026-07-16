import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CustomersList from './_components/CustomersList'

export const metadata = { title: 'Customers | CRM' }

export default async function CustomersPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_READ)) redirect('/403')

  return (
    <CustomersList
      canScheduleReminder={can(session, CRM_PERMISSIONS.REMINDERS_CREATE)}
      canCreate={can(session, CRM_PERMISSIONS.CUSTOMERS_CREATE)}
      currentUserId={session.id}
      tenantId={session.enterpriseOwnerId ?? session.id}
    />
  )
}
