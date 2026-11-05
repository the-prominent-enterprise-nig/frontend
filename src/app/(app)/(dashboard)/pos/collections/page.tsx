import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canAny } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import CollectionsScreen from './_components/CollectionsScreen'

export const metadata = {
  title: 'Collections | NIG Central',
}

export default async function CollectionsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  // View Only (pos:customers:read) may look; collecting needs the collect permission.
  if (!canAny(session, [POS_PERMISSIONS.COLLECTIONS_MANAGE, POS_PERMISSIONS.CUSTOMERS_READ]))
    redirect('/403')

  return <CollectionsScreen canCollect={can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)} />
}
