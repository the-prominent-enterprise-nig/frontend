import { notFound, redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { getVehicle } from '../../_actions/get-vehicle'
import { VehicleForm } from '../../_components/VehicleForm'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'

export const metadata = { title: 'Edit Vehicle | NIG Central' }

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canAny(session, DRIVER_ACCESS.UPDATE)) redirect('/403')

  const { id } = await params
  const result = await getVehicle(id)
  if (!result.success || !result.data) notFound()

  return <VehicleForm vehicle={result.data} branchLocked={Boolean(session.branchId)} />
}
