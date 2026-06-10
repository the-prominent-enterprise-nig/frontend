'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { BatchListResponse, BatchListResponseSchema } from '@/src/schema/inventory/quality-hold'

type GetQualityHoldsParams = {
  page?: number
  limit?: number
  itemId?: string
  status?: 'active' | 'quarantine' | 'expired' | 'recalled'
}

export async function getQualityHolds(
  params: GetQualityHoldsParams = {}
): Promise<ApiResponse<BatchListResponse>> {
  const result = await api.get<BatchListResponse>('/inventory/batches', {
    status: params.status ?? 'quarantine',
    itemId: params.itemId,
    page: params.page,
    limit: params.limit,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load quality holds',
      message: typeof result.message === 'string' ? result.message : 'Failed to load quality holds',
    }
  }

  const parsed = BatchListResponseSchema.safeParse(result.data)
  return { success: true, data: parsed.success ? parsed.data : (result.data as any) }
}
