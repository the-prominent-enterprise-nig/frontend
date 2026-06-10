import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import LeadDetail from './_components/LeadDetail'

export const metadata = { title: 'Lead Detail | CRM' }

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.LEADS_READ)) redirect('/403')

  const { id } = await params
  return (
    <LeadDetail
      id={id}
      canConvert={can(session, CRM_PERMISSIONS.LEADS_CONVERT)}
      canEdit={can(session, CRM_PERMISSIONS.LEADS_UPDATE)}
      canScheduleReminder={can(session, CRM_PERMISSIONS.REMINDERS_CREATE)}
      currentUserId={session.id}
      tenantId={session.enterpriseOwnerId ?? session.id}
    />
  )
}
