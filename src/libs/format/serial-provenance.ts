import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

/** Resolves a serial's origin for display: the supplier name when receipt was
 * supplier-sourced, or "WHSE" when it arrived via an internal stock transfer. */
export function originLabel(serial: SerialNumberSummary): string {
  const receipt = serial.goodsReceiptLine?.goodsReceipt
  if (!receipt) return '—'
  return receipt.supplier?.name ?? (receipt.stockTransferId ? 'WHSE' : '—')
}
