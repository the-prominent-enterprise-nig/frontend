import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import EditCustomerForm from './_components/EditCustomerForm'

export const metadata = { title: 'Edit Customer | CRM' }

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_UPDATE)) redirect('/403')

  const { id } = await params
  return <EditCustomerForm id={id} />
}
