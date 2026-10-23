import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { safeReturnTo } from '@/src/libs/guards/safe-return-to'
import CustomerForm from '../_components/CustomerForm'

export const metadata = { title: 'New Customer | CRM' }

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_CREATE)) redirect('/403')

  const { returnTo } = await searchParams

  return <CustomerForm returnTo={safeReturnTo(returnTo)} />
}
