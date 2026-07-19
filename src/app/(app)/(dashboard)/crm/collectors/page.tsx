import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CollectorsList from './_components/CollectorsList'

export const metadata = { title: 'Collectors | CRM' }

export default async function CollectorsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.COLLECTORS_READ)) redirect('/403')

  return <CollectorsList canCreate={can(session, CRM_PERMISSIONS.COLLECTORS_CREATE)} />
}
