'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  RecurringAmountsResponseSchema,
  type RecurringAmountsResponse,
} from '@/src/schema/accounting/recurring-expense-amounts'

type Params = {
  /** Payee, entry or voucher number, plate, or the line description. */
  search?: string
  /** Period covered, inclusive — YYYY-MM-DD, on the expense date. */
  from?: string
  to?: string
  page?: number
  limit?: number
}

// The amounts recorded under one entry of the Recurring Expenses list, read-only.
// Gated on accounting:expense:read by the API, which also limits a branch user to
// their own branch.
export async function getRecurringAmounts(
  typeId: string,
  params: Params = {}
): Promise<ApiResponse<RecurringAmountsResponse>> {
  const result = await api.get<RecurringAmountsResponse>(
    `/expenses/recurring-types/${typeId}/amounts`,
    { ...params },
    { tags: ['accounting-expenses'] }
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch the recorded amounts',
      message: result.message,
    }
  }

  const validated = RecurringAmountsResponseSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
