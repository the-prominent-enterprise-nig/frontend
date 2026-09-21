import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ManualRrDetail from '../_components/ManualRrDetail'

export const metadata = { title: 'Manual Receiving Report' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionOrNull()
  requirePermission(session, [
    INVENTORY_PERMISSIONS.MANUAL_RR_CREATE,
    ACCOUNTING_PERMISSIONS.MANUAL_RR_CREATE,
  ])
  return <ManualRrDetail id={id} />
}
