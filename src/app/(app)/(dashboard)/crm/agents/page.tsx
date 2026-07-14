import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import AgentsList from './_components/AgentsList'

export const metadata = { title: 'Sales Agents | CRM' }

export default async function AgentsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.AGENTS_READ)) redirect('/403')

  return (
    <AgentsList
      canCreate={can(session, CRM_PERMISSIONS.AGENTS_CREATE)}
      canUpdate={can(session, CRM_PERMISSIONS.AGENTS_UPDATE)}
      canDelete={can(session, CRM_PERMISSIONS.AGENTS_DELETE)}
    />
  )
}
