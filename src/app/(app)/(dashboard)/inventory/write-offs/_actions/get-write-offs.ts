'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { WriteOffListResponse, WriteOffListResponseSchema } from '@/src/schema/inventory/write-offs'

type GetWriteOffsParams = {
  page?: number
  limit?: number
  reasonCode?: string
  itemId?: string
  warehouseId?: string
  from?: string
  to?: string
}

export async function getWriteOffs(
  params: GetWriteOffsParams = {}
): Promise<ApiResponse<WriteOffListResponse>> {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    reasonCode: params.reasonCode,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    from: params.from,
    to: params.to,
  }

  const result = await api.get<WriteOffListResponse>('/inventory/adjustments', query)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load write-offs',
      message: typeof result.message === 'string' ? result.message : 'Failed to load write-offs',
    }
  }

  const parsed = WriteOffListResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: true, data: result.data }
  }

  return { success: true, data: parsed.data }
}
