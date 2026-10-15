import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { DrPurposeSchema, isRepairPurpose } from '@/src/schema/inventory/delivery-receipts'
import DrForm from '../_components/DrForm'

export const metadata = { title: 'New Delivery Receipt' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string; udsId?: string }>
}): Promise<React.JSX.Element> {
  const session = await getSessionOrNull()
  requirePermission(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE)
  // Scenario 72 Part 7 — the UDS list opens a repair DR for one ticket.
  const { purpose, udsId } = await searchParams
  const parsed = DrPurposeSchema.safeParse(purpose)
  const preset =
    parsed.success && isRepairPurpose(parsed.data)
      ? { purpose: parsed.data, udsId: udsId ?? '' }
      : undefined
  return <DrForm preset={preset} />
}
