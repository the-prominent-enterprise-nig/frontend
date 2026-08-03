import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CollectorDetail from './_components/CollectorDetail'

export const metadata = { title: 'Collector Detail | CRM' }

export default async function CollectorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.COLLECTORS_READ)) redirect('/403')

  const { id } = await params
  return (
    <CollectorDetail
      id={id}
      canEdit={can(session, CRM_PERMISSIONS.COLLECTORS_UPDATE)}
      canRemit={can(session, CRM_PERMISSIONS.COLLECTORS_REMIT)}
    />
  )
}
