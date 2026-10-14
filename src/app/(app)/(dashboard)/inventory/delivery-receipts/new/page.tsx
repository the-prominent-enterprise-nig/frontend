import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import DrForm from '../_components/DrForm'

export const metadata = { title: 'New Delivery Receipt' }

export default async function Page(): Promise<React.JSX.Element> {
  const session = await getSessionOrNull()
  requirePermission(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE)
  return <DrForm />
}
