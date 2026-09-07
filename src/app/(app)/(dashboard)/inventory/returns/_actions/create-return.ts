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

  return {
    success: true,
    data: result.data,
    message: memoNumber
      ? `Stock updated and credit memo ${memoNumber} issued against the invoice.`
      : note
        ? `Stock updated. ${note}`
        : 'Return processed and stock balance updated',
  }
}
