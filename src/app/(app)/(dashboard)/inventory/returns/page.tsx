import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ReturnList } from './_components'

export const metadata = {
  title: 'Stock Returns | Prominent Enterprise',
  description:
    'Process returned items back into inventory with condition inspection and full traceability',
}

export default async function ReturnsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.STOCKS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <ReturnList session={session} />
    </div>
  )
}
