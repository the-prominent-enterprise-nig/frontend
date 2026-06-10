import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { SerialNumberList } from './_components'

export const metadata = {
  title: 'Serial Number Tracking | Prominent Enterprise',
  description: 'Register, search, and track individual serial numbers across their lifecycle',
}

export default async function SerialNumbersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.SERIAL_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <SerialNumberList session={session} />
    </div>
  )
}
