import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

type PoStatus = PurchaseOrderSummary['status']

/** Only a draft or approved PO is edited. Once sent it is the supplier's
 * document; a delivery that doesn't match it (another model, an extra unit)
 * is handled on the receive screen. Mirrors PurchaseOrderService.update. */
export function canEditPoStatus(status: PoStatus): boolean {
  return status === 'draft' || status === 'approved'
}

/** Draft and approved by anyone with the permission; a sent PO by Head Office
 * while nothing has been received. */
export function canCancelPoStatus(po: PurchaseOrderSummary, headOffice: boolean): boolean {
  if (po.status === 'draft' || po.status === 'approved') return true
  const received = po.lines.some((l) => Number(l.receivedQuantity ?? 0) > 0)
  return headOffice && po.status === 'sent' && !received
}

const EDIT_CANCEL_ERRORS: [code: string, message: string][] = [
  [
    'only_head_office_can_cancel_sent_po',
    'Only Head Office can cancel a PO already sent to the supplier.',
  ],
  [
    'po_has_receipts_close_instead',
    'Stock was already received on this PO, so it can’t be cancelled.',
  ],
  ['po_status_not_editable', 'This PO can no longer be edited.'],
]

/** The readable message for a PO edit/cancel error code, else the raw text. */
export function poEditErrorMessage(raw: string): string {
  return EDIT_CANCEL_ERRORS.find(([code]) => raw.includes(code))?.[1] ?? raw
}
