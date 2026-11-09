import type { RepairIntakeSale } from '../../_actions/get-repair-intake-sales'
import type {
  RecordCustomerReturnInput,
  RrReturnDisposition,
} from '../../_actions/record-customer-return'

/** Ticket #27 — the POS customer return a Return on Create RR posts: the
 * picked sale and its checked serials, each with what happens to it. */
export function customerReturnPayload({
  sale,
  serialNumberIds,
  dispositions,
  warehouseId,
  notes,
}: {
  sale: RepairIntakeSale
  serialNumberIds: string[]
  dispositions: Record<string, RrReturnDisposition>
  warehouseId: string
  notes?: string
}): RecordCustomerReturnInput {
  const lines = sale.unitItems
    .filter((u) => u.serialNumberId && serialNumberIds.includes(u.serialNumberId))
    .map((u) => ({
      itemId: u.itemId as string,
      serialNumberId: u.serialNumberId as string,
      unitPrice: u.unitPrice ?? 0,
      disposition: dispositions[u.serialNumberId as string] ?? 'restock',
      // The unit's id is its POS sale line.
      sourcePosTransactionLineId: u.id,
      sourceLedgerId: u.sourceLedgerId ?? undefined,
    }))
  return {
    warehouseId,
    customerId: sale.customer?.id,
    originalSaleId: sale.id,
    arInvoiceId: sale.arInvoiceId ?? undefined,
    // siNumber falls back to the POS number; only a real SI No. is sent.
    salesInvoiceNumber: sale.siNumber !== sale.transactionNumber ? sale.siNumber : undefined,
    notes: notes?.trim() || undefined,
    lines,
  }
}
