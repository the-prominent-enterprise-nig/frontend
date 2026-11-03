/**
 * What a POS sale is called on screen: the SI No. (or the DR No., which is
 * stored in the same column) the customer holds on paper — never the internal
 * `POS-<epoch>-<rand>` transaction number. Only a refund, or a sale booked
 * before the SI No. became required at checkout, has none and falls back to
 * the transaction number. Mirrors the backend's `saleDocNo`.
 */
export function saleDocNo(tx: {
  transactionNumber: string
  salesInvoiceNumber?: string | null
}): string {
  return tx.salesInvoiceNumber?.trim() || tx.transactionNumber
}
