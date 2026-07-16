import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import NewCustomerForm from './_components/NewCustomerForm'

export const metadata = { title: 'New Customer | CRM' }

export default async function NewCustomerPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_CREATE)) redirect('/403')

  return <NewCustomerForm />
}
