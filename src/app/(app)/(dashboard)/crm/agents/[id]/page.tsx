import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, hasPrivilegedRole, isSuperAdmin } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import AgentInvoices from './_components/AgentInvoices'

export const metadata = { title: 'Sales Agent | CRM' }

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.AGENTS_READ)) redirect('/403')

  const { id } = await params
  // Edit and Remove are the Business Owner's alone (ticket #41). Branch roles
  // hold crm:*:*, which carries these two permissions, so the permission check
  // alone would still show the buttons — the backend refuses them as well.
  const isOwner = isSuperAdmin(session) || hasPrivilegedRole(session)
  return (
    <AgentInvoices
      id={id}
      canUpdate={isOwner && can(session, CRM_PERMISSIONS.AGENTS_UPDATE)}
      canDelete={isOwner && can(session, CRM_PERMISSIONS.AGENTS_DELETE)}
    />
  )
}
