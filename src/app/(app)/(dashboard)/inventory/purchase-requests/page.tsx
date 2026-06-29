import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { PurchaseRequestList } from './_components/PurchaseRequestList'

export const metadata = {
  title: 'Purchase Requests | Prominent Enterprise',
  description: 'Create and manage purchase requests for inventory procurement',
}

export default async function PurchaseRequestsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, PROCUREMENT_PERMISSIONS.PR_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <PurchaseRequestList />
    </div>
  )
}
