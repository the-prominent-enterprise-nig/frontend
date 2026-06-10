import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import NewLeadForm from './_components/NewLeadForm'

export const metadata = { title: 'New Lead | CRM' }

export default async function NewLeadPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.LEADS_CREATE)) redirect('/403')

  return <NewLeadForm tenantId={session.enterpriseOwnerId ?? session.id} />
}
