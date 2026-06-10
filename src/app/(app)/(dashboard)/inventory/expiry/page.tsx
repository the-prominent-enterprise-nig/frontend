import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ExpiryDashboard } from './_components'

export const metadata = {
  title: 'Expiry Tracking | Prominent Enterprise',
  description: 'Monitor batch expiry dates with FEFO sorting',
}

export default async function ExpiryPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.EXPIRY_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <ExpiryDashboard />
    </div>
  )
}
