import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import AgentInvoices from './_components/AgentInvoices'

export const metadata = { title: 'Sales Agent | CRM' }

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.AGENTS_READ)) redirect('/403')

  const { id } = await params
  return (
    <AgentInvoices
      id={id}
      canUpdate={can(session, CRM_PERMISSIONS.AGENTS_UPDATE)}
      canDelete={can(session, CRM_PERMISSIONS.AGENTS_DELETE)}
    />
  )
}
