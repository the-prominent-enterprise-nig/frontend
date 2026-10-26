import { notFound, redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { getVehicle } from '../_actions/get-vehicle'
import { VehicleDetail } from '../_components/VehicleDetail'

export const metadata = { title: 'Vehicle | NIG Central' }

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (
    !canAny(session, [INVENTORY_PERMISSIONS.TRANSFERS_READ, ACCOUNTING_PERMISSIONS.EXPENSE_READ])
  ) {
    redirect('/403')
  }

  const { id } = await params
  const result = await getVehicle(id)
  if (!result.success || !result.data) notFound()

  return <VehicleDetail vehicle={result.data} session={session} />
}
