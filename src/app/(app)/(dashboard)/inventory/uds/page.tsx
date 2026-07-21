import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import UdsList from './_components/UdsList'

export const metadata = {
  title: 'Unit Document Sheets | Prominent Enterprise',
  description: 'Track units leaving the warehouse for repair, pull-out, maintenance, or loan.',
}

export default async function UdsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.UDS_READ)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <UdsList session={session} />
    </div>
  )
}
