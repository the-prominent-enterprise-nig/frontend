import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { VehicleForm } from '../_components/VehicleForm'

export const metadata = { title: 'Add Vehicle | NIG Central' }

export default async function NewVehiclePage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.DRIVERS_CREATE)) redirect('/403')

  return <VehicleForm branchLocked={Boolean(session.branchId)} />
}
