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
import { DrVoidAction } from '../_components/DrVoidAction'
import { DrProceedToPos } from '../_components/DrProceedToPos'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { isRepairPurpose } from '@/src/schema/inventory/delivery-receipts'

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
  const canVoid =
    (dr.status === 'approved' || dr.status === 'posted') &&
    // A repair DR has already moved its ticket; there is no undoing that.
    !isRepairPurpose(dr.purpose) &&
    can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_VOID)
  // A return to supplier's memo is a supplier debit memo, which lives on the
  // Inventory → Debit Memos list rather than a page of its own.
  const memoHref = dr.supplierDebitMemo
    ? can(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_READ)
      ? '/inventory/debit-memos'
      : undefined
    : dr.debitMemo && can(session, ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_READ)
      ? `/accounting/debit-memos/inventory/${dr.debitMemo.id}`
      : undefined
  // Scenario 72 Part 6 — an approved sales invoice to follow is rung up at
  // POS by whoever can sell there.
  const canSell =
    dr.status === 'approved' &&
    dr.purpose === 'sales_invoice_to_follow' &&
    can(session, POS_PERMISSIONS.TRANSACTIONS_CREATE)
  return (
    <DrDetailView
      dr={dr}
      memoHref={memoHref}
      actions={
        canDecide ? (
          <DrApprovalActions dr={dr} />
        ) : canVoid || canSell ? (
          <>
            {canVoid && <DrVoidAction dr={dr} />}
            {canSell && <DrProceedToPos dr={dr} userId={session.id} />}
          </>
        ) : undefined
      }
    />
  )
}
