import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { safeReturnTo } from '@/src/libs/guards/safe-return-to'
import CustomerForm from '../../../crm/customers/_components/CustomerForm'

export const metadata = { title: 'New Customer | POS' }

export default async function NewPosCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.CUSTOMERS_CREATE)) redirect('/403')

  const { returnTo } = await searchParams

  // Same form component as CRM's, pointed at POS's API and routes — the
  // cashier gets the identical capture screen (birthday pickers, co-makers,
  // ID documents) without holding any crm:* permission.
  return <CustomerForm returnTo={safeReturnTo(returnTo)} scope="pos" />
}
