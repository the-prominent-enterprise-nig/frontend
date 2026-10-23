'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { REASON_LABELS, type CustomerReturnFormValues } from '@/src/schema/inventory/returns'

/**
 * The posted document, as the server reports it back.
 *
 * `creditMemoId: null` is NOT a failure. A cash return, or one against an
 * already-settled invoice, posts correctly and explains itself in
 * `accountingNote` — the stock is on the shelf and its cost reversal is
 * already in the ledger either way. Reading a null memo as a failed submit is
 * the easiest mistake to make against this endpoint.
 */
export type CustomerReturnResult = {
  id: string
  returnNumber: string
  receivingReportNumber: string
  creditMemoId?: string | null
  creditMemoNumber?: string | null
  accountingNote?: string | null
  arInvoiceId?: string | null
  lineCount?: number
}

/**
 * The two answers the form asks, as the one column the document carries.
 *
 * CustomerReturnLine has a single `reason`, and splitting it into a coded
 * field plus a note would be a migration for something every reader of it —
 * the detail panel, the customer's copy, whoever picks up the repair — wants
 * to read as one sentence anyway. The label leads so the fixed list is still
 * legible at a glance; the fault follows it verbatim.
 */
function reasonText(line: CustomerReturnFormValues['lines'][number]): string | undefined {
  const label = line.reasonCode ? REASON_LABELS[line.reasonCode] : ''
  const fault = line.faultNote?.trim()
  const text = [label, fault].filter(Boolean).join(' — ')
  return text ? text.slice(0, 500) : undefined
}

export async function createCustomerReturn(
  input: CustomerReturnFormValues
): Promise<ApiResponse<CustomerReturnResult>> {
  // Deliberately not re-parsed here: the form already validated this with the
  // same schema through zodResolver, and running it twice only meant a second
  // set of error messages that never reached the fields they belonged to.
  const payload = {
    warehouseId: input.warehouseId,
    customerId: input.customerId || undefined,
    originalSaleId: input.originalSaleId || undefined,
    arInvoiceId: input.arInvoiceId || undefined,
    salesInvoiceNumber: input.salesInvoiceNumber || undefined,
    notes: input.notes || undefined,
    lines: input.lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      disposition: line.disposition,
      serialNumberId: line.serialNumberId || undefined,
      sourcePosTransactionLineId: line.sourcePosTransactionLineId || undefined,
      sourceLedgerId: line.sourceLedgerId || undefined,
      replacementSerialNumberId: line.replacementSerialNumberId || undefined,
      reason: reasonText(line),
    })),
  }

  const result = await api.post<CustomerReturnResult>('/inventory/stock/customer-returns', payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to record the return',
      message: msg || errStr || 'Failed to record the return',
    }
  }

  revalidatePath('/inventory/returns')

  // The RR leads, because the customer is standing at the counter waiting for
  // a number to write on their copy and nothing else has to happen before they
  // can leave. What became of their money follows in the same breath, since
  // that is the other thing they will ask.
  const rr = result.data?.receivingReportNumber
  const memo = result.data?.creditMemoNumber
  const note = result.data?.accountingNote

  const tail = memo ? `Credit memo ${memo} issued against the invoice.` : note || null

  return {
    success: true,
    data: result.data,
    message: [rr ? `RR ${rr} issued — write this on the customer's copy.` : null, tail]
      .filter(Boolean)
      .join(' '),
  }
}
