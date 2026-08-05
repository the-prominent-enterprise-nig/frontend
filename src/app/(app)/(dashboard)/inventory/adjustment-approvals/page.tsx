import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import AdjustmentApprovalsList from './_components/AdjustmentApprovalsList'

export const metadata = {
  title: 'Adjustment Approvals | Prominent Enterprise',
  description: 'Confirm, investigate, and approve or reject pending stock adjustments',
}

export default async function AdjustmentApprovalsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const canView =
    can(session, INVENTORY_PERMISSIONS.STOCK_ADJUST) ||
    can(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM) ||
    can(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE)

  if (!canView) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdjustmentApprovalsList session={session} />
    </div>
  )
}
