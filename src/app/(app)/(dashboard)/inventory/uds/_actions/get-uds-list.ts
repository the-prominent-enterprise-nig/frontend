'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { UdsListResponseSchema, type UdsListResponse } from '@/src/schema/inventory/uds'

export async function getUdsList(params?: {
  page?: number
  limit?: number
  status?: string
  reason?: string
  warehouseId?: string
}): Promise<ApiResponse<UdsListResponse>> {
  const result = await api.get<UdsListResponse>('/inventory/uds', params, {
    tags: ['inventory-uds'],
  })

  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? 'Failed to load UDS records', message: '' }
  }

  const parsed = UdsListResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid response from server', message: '' }
  }

  return { success: true, data: parsed.data, message: '' }
}
