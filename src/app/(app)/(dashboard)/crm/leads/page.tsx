import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import LeadsList from './_components/LeadsList'

export const metadata = { title: 'Leads | CRM' }

export default async function LeadsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.LEADS_READ)) redirect('/403')

  return (
    <LeadsList
      canCreate={can(session, CRM_PERMISSIONS.LEADS_CREATE)}
      canScheduleReminder={can(session, CRM_PERMISSIONS.REMINDERS_CREATE)}
      currentUserId={session.id}
      tenantId={session.enterpriseOwnerId ?? session.id}
    />
  )
}
