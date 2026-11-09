'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  ElectricityPaymentsResponseSchema,
  type ElectricityPaymentsResponse,
} from '@/src/schema/accounting/electricity'

type Params = {
  /** Payee, entry or voucher number, or the line description. */
  search?: string
  /** Period covered, inclusive — YYYY-MM-DD, on the expense date. */
  from?: string
  to?: string
  page?: number
  limit?: number
}

// The payments recorded on Electricity / Light Expense, for the Electricity tab.
// Gated on accounting:expense:read by the API, which also limits a branch user to
// their own branch.
export async function getElectricityPayments(
  params: Params = {}
): Promise<ApiResponse<ElectricityPaymentsResponse>> {
  const result = await api.get<ElectricityPaymentsResponse>(
    '/expenses/electricity/payments',
    { ...params },
    { tags: ['accounting-expenses'] }
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch electricity payments',
      message: result.message,
    }
  }

  const validated = ElectricityPaymentsResponseSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
