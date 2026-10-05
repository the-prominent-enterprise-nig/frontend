import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { DriverForm } from '../_components/DriverForm'

export const metadata = { title: 'Add Driver | NIG Central' }

export default async function NewDriverPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.DRIVERS_CREATE)) redirect('/403')

  return <DriverForm branchLocked={Boolean(session.branchId)} />
}
