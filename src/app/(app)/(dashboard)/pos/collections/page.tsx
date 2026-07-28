import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import CollectionsScreen from './_components/CollectionsScreen'

export const metadata = {
  title: 'Collections | Prominent Enterprise',
}

export default async function CollectionsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)) redirect('/pos')

  return <CollectionsScreen />
}
