'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  DrListResponseSchema,
  type DrListResponse,
  type DrPurpose,
  type DrStatus,
} from '@/src/schema/inventory/delivery-receipts'

export async function getDeliveryReceipts(params?: {
  page?: number
  limit?: number
  status?: DrStatus
  purpose?: DrPurpose
  search?: string
}): Promise<ApiResponse<DrListResponse>> {
  const result = await api.get<DrListResponse>('/inventory/delivery-receipts', params)
  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error ?? 'Failed to load delivery receipts',
      message: '',
    }
  }
  const parsed = DrListResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid response from server', message: '' }
  }
  return { success: true, data: parsed.data, message: '' }
}
