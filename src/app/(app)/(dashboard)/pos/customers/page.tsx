import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import PosCustomersList from './_components/PosCustomersList'

export const metadata = { title: 'Customers | POS' }

export default async function PosCustomersPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.CUSTOMERS_READ)) redirect('/403')

  return (
    <PosCustomersList
      canCreate={can(session, POS_PERMISSIONS.CUSTOMERS_CREATE)}
      canUpdate={can(session, POS_PERMISSIONS.CUSTOMERS_UPDATE)}
    />
  )
}
