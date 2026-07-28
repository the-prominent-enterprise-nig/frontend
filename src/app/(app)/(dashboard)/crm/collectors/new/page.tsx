import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import NewCollectorForm from './_components/NewCollectorForm'

export const metadata = { title: 'New Collector | CRM' }

export default async function NewCollectorPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.COLLECTORS_CREATE)) redirect('/403')

  return <NewCollectorForm />
}
