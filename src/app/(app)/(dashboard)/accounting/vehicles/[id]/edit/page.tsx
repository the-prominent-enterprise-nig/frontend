import { notFound, redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { getVehicle } from '../../_actions/get-vehicle'
import { VehicleForm } from '../../_components/VehicleForm'

export const metadata = { title: 'Edit Vehicle | NIG Central' }

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.DRIVERS_UPDATE)) redirect('/403')

  const { id } = await params
  const result = await getVehicle(id)
  if (!result.success || !result.data) notFound()

  return <VehicleForm vehicle={result.data} branchLocked={Boolean(session.branchId)} />
}
