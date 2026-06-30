import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import VoidRequestsList from './_components/VoidRequestsList'

export const metadata = {
  title: 'Void Requests | Prominent Enterprise',
}

export default async function VoidRequestsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.TRANSACTIONS_READ)) redirect('/pos')

  const isManager = can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)

  return <VoidRequestsList isManager={isManager} />
}
