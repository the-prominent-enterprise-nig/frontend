'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { ReturnListResponse, ReturnListResponseSchema } from '@/src/schema/inventory/returns'

type GetReturnsParams = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  startDate?: string
  endDate?: string
}

export async function getReturns(
  params: GetReturnsParams = {}
): Promise<ApiResponse<ReturnListResponse>> {
  const result = await api.get<ReturnListResponse>('/inventory/stock/ledger', {
    transactionType: 'return',
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    startDate: params.startDate,
    endDate: params.endDate,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load returns',
      message: typeof result.message === 'string' ? result.message : 'Failed to load returns',
    }
  }

  const parsed = ReturnListResponseSchema.safeParse(result.data)
  return { success: true, data: parsed.success ? parsed.data : (result.data as any) }
}
