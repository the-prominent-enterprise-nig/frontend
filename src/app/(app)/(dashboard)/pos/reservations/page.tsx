import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { RESERVATION_ACCESS } from '@/src/libs/guards/shared-ownership'
import SkuReservationsList from './_components/SkuReservationsList'

export const metadata = {
  title: 'Reservations | NIG Central',
}

// Scenario 03, Part 7 — the reservations list/detail Parts 1-6 never got a
// frontend surface for: fulfil, request-cancel, and (Branch Manager/Owner
// only) approve/reject-cancel were API-only until now.
export default async function SkuReservationsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  // A POS page: POS's permission opens it as well as Inventory's.
  if (!canAny(session, RESERVATION_ACCESS.READ)) redirect('/403')

  const canFulfil = canAny(session, RESERVATION_ACCESS.FULFIL)
  const canRequestCancel = canAny(session, RESERVATION_ACCESS.CANCEL_REQUEST)
  const canApprove = canAny(session, RESERVATION_ACCESS.CANCEL_APPROVE)

  return (
    <SkuReservationsList
      canFulfil={canFulfil}
      canRequestCancel={canRequestCancel}
      canApprove={canApprove}
    />
  )
}
