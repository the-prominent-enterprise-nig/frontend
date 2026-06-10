import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ReservationsPageView } from './_components'

export const metadata = {
  title: 'Stock Reservations | Prominent Enterprise',
  description: 'View and manage stock reservations for sales orders and production',
}

export default async function ReservationsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.RESERVATIONS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <ReservationsPageView session={session} />
    </div>
  )
}
