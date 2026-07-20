import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import Customer360 from './_components/Customer360'

export const metadata = { title: 'Customer | CRM' }

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_READ)) redirect('/403')

  const { id } = await params
  return (
    <Customer360
      id={id}
      canEdit={can(session, CRM_PERMISSIONS.CUSTOMERS_UPDATE)}
      canDelete={can(session, CRM_PERMISSIONS.CUSTOMERS_DELETE)}
      canScheduleReminder={can(session, CRM_PERMISSIONS.REMINDERS_CREATE)}
      currentUserId={session.id}
      tenantId={session.enterpriseOwnerId ?? session.id}
    />
  )
}
