'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { ReturnListResponse, ReturnListResponseSchema } from '@/src/schema/inventory/returns'

/** Which of the three shapes of record a row is — not a status. */
export type ReturnOutcome = 'restocked' | 'in_repair' | 'document'

type GetReturnsParams = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  startDate?: string
  endDate?: string
  /** One box over every number a customer could quote back at the counter:
   *  RTN, RR, SI, credit memo, UDS code, serial, item and customer. */
  search?: string
  outcome?: ReturnOutcome
}

export async function getReturns(
  params: GetReturnsParams = {}
): Promise<ApiResponse<ReturnListResponse>> {
  // Not /ledger: a repair intake writes no ledger row by design, so half of
  // what a clerk processed on this screen is invisible there. This endpoint
  // unions both outcomes.
  const result = await api.get<ReturnListResponse>('/inventory/stock/customer-returns', {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search,
    outcome: params.outcome,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load returns',
      message: typeof result.message === 'string' ? result.message : 'Failed to load returns',
    }
  }

  // An unparsed payload still beats an empty screen — the schema is
  // deliberately loose about the two legacy row shapes, and a field it has
  // not caught up with should not blank the list.
  const parsed = ReturnListResponseSchema.safeParse(result.data)
  return {
    success: true,
    data: parsed.success ? parsed.data : (result.data as ReturnListResponse),
  }
}
