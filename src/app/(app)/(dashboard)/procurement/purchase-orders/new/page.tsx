import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import NewPurchaseOrderForm from './_components/NewPurchaseOrderForm'

export const metadata = { title: 'New Purchase Order | Procurement' }

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ fromPr?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_CREATE)) redirect('/403')

  const { fromPr } = await searchParams
  return (
    <NewPurchaseOrderForm tenantId={session.enterpriseOwnerId ?? session.id} fromPrId={fromPr} />
  )
}
