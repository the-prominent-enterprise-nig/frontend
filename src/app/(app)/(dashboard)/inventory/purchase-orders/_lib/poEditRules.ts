import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

type PoStatus = PurchaseOrderSummary['status']

/** Draft and approved by anyone with the permission. Head Office (the Sales
 * Admin) also edits a sent or received PO, for a delivery that doesn't match
 * it — a received line keeps its item and quantity, but a cost change on it
 * reaches its receiving reports. Mirrors PurchaseOrderService.assertEditable. */
export function canEditPoStatus(status: PoStatus, headOffice: boolean): boolean {
  if (status === 'draft' || status === 'approved') return true
  return headOffice && SUPPLIER_STATUSES.includes(status)
}

/** Statuses where the PO is already with the supplier. */
export const SUPPLIER_STATUSES: PoStatus[] = ['sent', 'partially_received', 'fully_received']

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
  [
    'only_head_office_can_edit_sent_po',
    'Only Head Office can edit a PO already sent to the supplier.',
  ],
  ['po_received_line_required', 'A line with stock already received can’t be removed.'],
  ['po_received_line_item_locked', 'A line with stock already received can’t change item.'],
  [
    'po_line_quantity_below_received',
    'A line’s quantity can’t go below what was already received.',
  ],
  [
    'po_cost_correction_reason_required',
    'Say why the cost changed — it updates the receiving reports and the books.',
  ],
]

/** The readable message for a PO edit/cancel error code, else the raw text. */
export function poEditErrorMessage(raw: string): string {
  return EDIT_CANCEL_ERRORS.find(([code]) => raw.includes(code))?.[1] ?? raw
}

type FormLine = {
  lineId?: string
  unitPrice: number
  srp?: number
  discounts?: { name?: string; type: string; value: number }[]
  isFreebie?: boolean
}

/** Whether the edit changes the pricing of a line that already has stock
 * received — the server then pushes it to the receiving reports, and wants a
 * reason. Mirrors PurchaseOrderService.receivedCostChanges. */
export function receivedCostChanged(
  po: PurchaseOrderSummary | null | undefined,
  lines: FormLine[] | undefined
): boolean {
  if (!po) return false
  const norm = (d: FormLine['discounts']): string =>
    JSON.stringify((d ?? []).map((x) => ({ name: x.name, type: x.type, value: Number(x.value) })))
  return (lines ?? []).some((line) => {
    const was = po.lines.find((l) => l.id === line.lineId)
    if (!was || Number(was.receivedQuantity ?? 0) <= 0) return false
    if (was.isFreebie || line.isFreebie) return false
    return (
      Number(was.unitPrice) !== Number(line.unitPrice) ||
      (was.srp == null ? null : Number(was.srp)) !== (line.srp ?? null) ||
      norm(was.discounts ?? []) !== norm(line.discounts)
    )
  })
}
