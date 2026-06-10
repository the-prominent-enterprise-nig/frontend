import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import PurchaseRequestsList from './_components/PurchaseRequestsList'

export const metadata = { title: 'Purchase Requests | Procurement' }

export default async function PurchaseRequestsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.PR_READ)) redirect('/403')

  return (
    <PurchaseRequestsList
      canCreate={can(session, PROCUREMENT_PERMISSIONS.PR_CREATE)}
      currentUserId={session.id}
      tenantId={session.enterpriseOwnerId ?? session.id}
    />
  )
}
