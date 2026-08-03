import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import DuplicatesReview from './_components/DuplicatesReview'

export const metadata = { title: 'Duplicate Customers | CRM' }

export default async function DuplicateCustomersPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_MERGE)) redirect('/403')

  return <DuplicatesReview />
}
