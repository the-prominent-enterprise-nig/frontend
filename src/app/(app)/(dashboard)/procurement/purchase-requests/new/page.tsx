import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import NewPurchaseRequestForm from './_components/NewPurchaseRequestForm'

export const metadata = { title: 'New Purchase Request | Procurement' }

export default async function NewPurchaseRequestPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.PR_CREATE)) redirect('/403')

  return (
    <NewPurchaseRequestForm
      tenantId={session.enterpriseOwnerId ?? session.id}
      currentUserId={session.id}
    />
  )
}
