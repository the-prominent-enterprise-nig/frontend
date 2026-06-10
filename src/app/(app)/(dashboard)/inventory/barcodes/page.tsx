import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { BarcodesPageView } from './_components'

export const metadata = {
  title: 'Barcode Management | Prominent Enterprise',
  description: 'Generate and manage barcodes assigned to inventory items',
}

export default async function BarcodesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.BARCODES_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <BarcodesPageView session={session} />
    </div>
  )
}
