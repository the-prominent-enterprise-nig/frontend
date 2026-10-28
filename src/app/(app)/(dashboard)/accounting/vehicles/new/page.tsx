import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { VehicleForm } from '../_components/VehicleForm'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'

export const metadata = { title: 'Add Vehicle | NIG Central' }

export default async function NewVehiclePage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canAny(session, DRIVER_ACCESS.CREATE)) redirect('/403')

  return <VehicleForm branchLocked={Boolean(session.branchId)} />
}
