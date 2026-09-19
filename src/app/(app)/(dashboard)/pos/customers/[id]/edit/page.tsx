import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import CustomerForm from '../../../../crm/customers/_components/CustomerForm'

export const metadata = { title: 'Edit Customer | POS' }

export default async function EditPosCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.CUSTOMERS_UPDATE)) redirect('/403')

  const { id } = await params

  return <CustomerForm id={id} scope="pos" />
}
