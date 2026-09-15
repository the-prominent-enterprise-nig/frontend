'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateReturnFormSchema } from '@/src/schema/inventory/returns'

/** What the backend reports back about the accounting half of the return.
 *  `accountingNote` is set only when something did not happen — a cash sale
 *  with nothing to credit, an item with no cost on record, a memo that could
 *  not be issued — so it can be said out loud instead of left to a log. */
type ProcessReturnResult = {
  id?: string
  journalEntryId?: string | null
  creditMemo?: { id: string; memoNumber: string } | null
  accountingNote?: string | null
  /** Present only on a repair intake, which raises a UDS instead of a stock
   *  movement. Its RR number is issued server-side and is what the customer
   *  walks away with, so it has to come back out to be read aloud. */
  uds?: { id: string; code: string; intakeReceivingReportNumber?: string | null } | null
  /** The stock movement, on a return that actually restocked. Carries the RR
   *  issued to the customer for the goods they handed over. */
  ledger?: { id: string; receivingReportNumber?: string | null } | null
}

export async function createReturn(input: unknown): Promise<ApiResponse<ProcessReturnResult>> {
  const parsed = CreateReturnFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const payload = {
    ...parsed.data,
  }

  const result = await api.post<ProcessReturnResult>('/inventory/stock/return', payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to process return',
      message: msg || errStr || 'Failed to process return',
    }
  }

  revalidatePath('/inventory/returns')

  const memoNumber = result.data?.creditMemo?.memoNumber
  const note = result.data?.accountingNote
  // Either outcome hands the customer an RR — a repair intake raises a UDS, a
  // restock writes a ledger row, and both are numbered off the same series.
  const rrNumber =
    result.data?.uds?.intakeReceivingReportNumber ?? result.data?.ledger?.receivingReportNumber

  // The RR leads: the customer is standing at the counter waiting for a number
  // to be written on their copy, and nothing else here has to happen before
  // they can leave. The accounting half follows in the same breath, because a
  // credit they were promised is the other thing they will ask about.
  const tail = memoNumber ? `Credit memo ${memoNumber} issued against the invoice.` : note || null

  return {
    success: true,
    data: result.data,
    message: rrNumber
      ? [`RR ${rrNumber} issued — write this on the customer's copy.`, tail]
          .filter(Boolean)
          .join(' ')
      : memoNumber
        ? `Stock updated and credit memo ${memoNumber} issued against the invoice.`
        : note
          ? `Stock updated. ${note}`
          : 'Return processed and stock balance updated',
  }
}
