import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { TransferList } from './_components'

export const metadata = {
  title: 'Stock Transfers | Prominent Enterprise',
  description: 'Transfer stock between warehouses with full ledger traceability',
}

export default async function TransfersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.TRANSFERS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <TransferList session={session} />
    </div>
  )
}
