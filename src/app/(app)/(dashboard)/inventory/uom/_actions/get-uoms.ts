'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { UomListResponse, UomListResponseSchema } from '@/src/schema/inventory/uom'

type GetUomsParams = {
  page?: number
  limit?: number
  search?: string
  isBaseUnit?: boolean
}

export async function getUoms(params: GetUomsParams = {}): Promise<ApiResponse<UomListResponse>> {
  const result = await api.get<UomListResponse>('/inventory/uom', {
    page: params.page,
    limit: params.limit,
    search: params.search,
    isBaseUnit: params.isBaseUnit,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load units of measure',
      message:
        typeof result.message === 'string' ? result.message : 'Failed to load units of measure',
    }
  }

  const parsed = UomListResponseSchema.safeParse(result.data)
  return { success: true, data: parsed.success ? parsed.data : (result.data as any) }
}
