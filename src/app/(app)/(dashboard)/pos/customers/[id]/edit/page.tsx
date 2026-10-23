import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { safeReturnTo } from '@/src/libs/guards/safe-return-to'
import CustomerForm from '../../../../crm/customers/_components/CustomerForm'

export const metadata = { title: 'Edit Customer | POS' }

export default async function EditPosCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.CUSTOMERS_UPDATE)) redirect('/403')

  const { id } = await params
  const { returnTo } = await searchParams

  return <CustomerForm id={id} scope="pos" returnTo={safeReturnTo(returnTo)} />
}
