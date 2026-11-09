'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import type { CustomerReturnResult } from '../../returns/_actions/create-customer-return'

/** What happens to a returned unit, from Create RR. Exchange stays on the POS
 * Returns screen — it needs a replacement unit. */
export type RrReturnDisposition = 'restock' | 'quarantine' | 'scrap'

export interface RecordCustomerReturnInput {
  warehouseId: string
  customerId?: string
  originalSaleId: string
  arInvoiceId?: string
  salesInvoiceNumber?: string
  notes?: string
  lines: {
    itemId: string
    serialNumberId: string
    unitPrice: number
    disposition: RrReturnDisposition
    sourcePosTransactionLineId: string
    sourceLedgerId?: string
  }[]
}

/** Ticket #27 — a Return on Create RR records the POS customer return itself
 * (stock back, customer credited, RRC # issued): the same request the POS
 * Returns screen posts, so it is still one record. */
export async function recordCustomerReturn(
  input: RecordCustomerReturnInput
): Promise<ApiResponse<CustomerReturnResult>> {
  const result = await api.post<CustomerReturnResult>('/inventory/stock/customer-returns', {
    ...input,
    lines: input.lines.map((line) => ({ ...line, quantity: 1 })),
  })
  if (result.success) return result
  const error = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
  const message = typeof result.message === 'string' ? result.message : ''
  return {
    success: false,
    error: error || 'Failed to record the return',
    message: message || error || 'Failed to record the return',
  }
}
