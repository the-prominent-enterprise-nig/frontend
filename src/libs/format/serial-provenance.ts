import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

/** Resolves a serial's origin for display: the supplier name when receipt was
 * supplier-sourced, "WHSE" when it arrived via an internal stock transfer, or
 * the customer it came back from on a repair/return or repossession. */
export function originLabel(serial: SerialNumberSummary): string {
  const receipt = serial.goodsReceiptLine?.goodsReceipt
  if (!receipt) return '—'
  if (receipt.supplier?.name) return receipt.supplier.name
  if (receipt.stockTransferId) return 'WHSE'
  return serial.returnOrigin?.customerName ?? '—'
}

/** The origin's reference: the transfer it arrived on, or the sales invoice
 * (else installment account) a returned or repossessed unit was sold on. */
export function originRef(serial: SerialNumberSummary): string | null {
  return (
    serial.goodsReceiptLine?.goodsReceipt?.stockTransfer?.transferNumber ??
    serial.returnOrigin?.reference ??
    null
  )
}

/** Where a sold unit went: its buyer, the sale's reference and date. Null
 * for a unit still on hand, which is wherever it is stored. */
export function soldDestination(
  serial: SerialNumberSummary
): { name: string; ref: string | null; date: string | null } | null {
  if (serial.status !== 'sold') return null
  return {
    name: serial.soldToCustomerName ?? 'Walk-in customer',
    ref: serial.sale?.reference ?? null,
    date: serial.sale?.date ?? serial.saleDate ?? null,
  }
}
