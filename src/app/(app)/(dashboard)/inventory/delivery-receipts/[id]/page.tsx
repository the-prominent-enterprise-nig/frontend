import { notFound } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { getDeliveryReceipt } from '../_actions/get-delivery-receipt'
import { drToFormValues } from '../_lib/dr-form-values'
import DrForm from '../_components/DrForm'
import DrDetailView from '../_components/DrDetailView'
import { DrApprovalActions } from '../_components/DrApprovalActions'

export const metadata = { title: 'Delivery Receipt' }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const session = requirePermission(await getSessionOrNull(), [
    INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_READ,
    INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE,
    INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_APPROVE,
  ])
  const { id } = await params
  const res = await getDeliveryReceipt(id)
  if (!res.success || !res.data) notFound()
  const dr = res.data
  // A draft opens straight into its form for whoever may edit it; anyone
  // else, and every later status, gets the read-only view.
  if (dr.status === 'draft' && can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_UPDATE)) {
    return <DrForm draft={{ id: dr.id, drNumber: dr.drNumber, values: drToFormValues(dr) }} />
  }
  const canDecide =
    dr.status === 'pending_approval' &&
    can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_APPROVE)
  return <DrDetailView dr={dr} actions={canDecide ? <DrApprovalActions dr={dr} /> : undefined} />
}
