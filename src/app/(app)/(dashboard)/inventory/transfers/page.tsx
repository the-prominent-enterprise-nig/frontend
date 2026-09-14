import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { TransferList } from './_components'

export const metadata = {
  title: 'Stock Transfers | Prominent Enterprise',
  description: 'Transfer stock between branches with full ledger traceability',
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
      {/* TransferList reads useSearchParams() for Item 360's "Transfer
          selected" deep link — required by Next.js so that read doesn't
          force the rest of this route out of static rendering. */}
      <Suspense fallback={null}>
        <TransferList session={session} />
      </Suspense>
    </div>
  )
}
