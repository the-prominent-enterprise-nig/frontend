import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CollectionIncentivesList from './_components/CollectionIncentivesList'

export const metadata = { title: 'Collection Incentives | CRM' }

export default async function CollectionIncentivesPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INCENTIVES_READ)) redirect('/403')

  return (
    <CollectionIncentivesList
      canCreate={can(session, CRM_PERMISSIONS.INCENTIVES_CREATE)}
      canApprove={can(session, CRM_PERMISSIONS.INCENTIVES_APPROVE)}
      canDelete={can(session, CRM_PERMISSIONS.INCENTIVES_DELETE)}
    />
  )
}
