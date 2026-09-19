import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ManualRrForm from '../_components/ManualRrForm'

export const metadata = { title: 'New Manual Receiving Report' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, [
    INVENTORY_PERMISSIONS.MANUAL_RR_CREATE,
    ACCOUNTING_PERMISSIONS.MANUAL_RR_CREATE,
  ])
  return <ManualRrForm />
}
