import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import SkuReservationsList from './_components/SkuReservationsList'

export const metadata = {
  title: 'Reservations | Prominent Enterprise',
}

// Scenario 03, Part 7 — the reservations list/detail Parts 1-6 never got a
// frontend surface for: fulfil, request-cancel, and (Branch Manager/Owner
// only) approve/reject-cancel were API-only until now.
export default async function SkuReservationsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.SKU_RESERVATIONS_READ)) redirect('/pos')

  const canFulfil = can(session, INVENTORY_PERMISSIONS.SKU_RESERVATIONS_FULFIL)
  const canRequestCancel = can(session, INVENTORY_PERMISSIONS.SKU_RESERVATIONS_CANCEL_REQUEST)
  const canApprove = can(session, INVENTORY_PERMISSIONS.SKU_RESERVATIONS_CANCEL_APPROVE)

  return (
    <SkuReservationsList
      canFulfil={canFulfil}
      canRequestCancel={canRequestCancel}
      canApprove={canApprove}
    />
  )
}
